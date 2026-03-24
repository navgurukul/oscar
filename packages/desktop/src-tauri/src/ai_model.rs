//! Local AI inference — quantized Phi-3.5-mini via candle.
//! Metal GPU on Apple Silicon/macOS, CPU elsewhere.

use candle_core::{quantized::gguf_file, Device, Tensor};
use candle_transformers::{generation::LogitsProcessor, models::quantized_phi3::ModelWeights};
use tokenizers::Tokenizer;

// Phi-3.5-mini EOS token IDs
const EOS_TOKEN_IDS: &[u32] = &[32007, 32000]; // <|end|>, <|endoftext|>

const SYSTEM_PROMPT: &str =
    "You are a precise transcript assistant. Follow instructions exactly. \
     Output only the requested content with no preamble, no explanations, no meta-commentary.";

pub struct AiModel {
    model: ModelWeights,
    tokenizer: Tokenizer,
    device: Device,
}

impl AiModel {
    pub fn load(gguf_path: &str, tokenizer_path: &str) -> Result<Self, String> {
        let device = best_device();
        log::info!("[ai] loading model on {:?}", device);

        let mut f = std::fs::File::open(gguf_path)
            .map_err(|e| format!("cannot open model: {e}"))?;
        let content = gguf_file::Content::read(&mut f)
            .map_err(|e| format!("cannot parse GGUF: {e}"))?;
        let model = ModelWeights::from_gguf(content, &mut f, &device)
            .map_err(|e| format!("cannot load weights: {e}"))?;

        let tokenizer = Tokenizer::from_file(tokenizer_path)
            .map_err(|e| format!("cannot load tokenizer: {e}"))?;

        log::info!("[ai] model ready");
        Ok(Self { model, tokenizer, device })
    }

    /// Generate a response, calling `on_token` for each new text piece (streaming).
    pub fn generate(
        &mut self,
        user_prompt: &str,
        max_new_tokens: usize,
        mut on_token: impl FnMut(String),
    ) -> Result<String, String> {
        // Phi-3.5 chat format
        let formatted = format!(
            "<|system|>\n{SYSTEM_PROMPT}<|end|>\n<|user|>\n{user_prompt}<|end|>\n<|assistant|>\n"
        );

        let encoded = self
            .tokenizer
            .encode(formatted.as_str(), true)
            .map_err(|e| format!("tokenization failed: {e}"))?;
        let prompt_ids: Vec<u32> = encoded.get_ids().to_vec();
        let prompt_len = prompt_ids.len();

        let input = Tensor::new(prompt_ids.as_slice(), &self.device)
            .and_then(|t| t.unsqueeze(0))
            .map_err(|e| format!("input tensor error: {e}"))?;

        // Prefill pass
        let logits = self
            .model
            .forward(&input, 0)
            .map_err(|e| format!("prefill error: {e}"))?;
        let logits = logits
            .i((.., prompt_len - 1, ..))
            .and_then(|t| t.squeeze(0))
            .map_err(|e| format!("logits slice error: {e}"))?;

        let mut lp = LogitsProcessor::new(42, Some(0.7), None);
        let mut next_token = lp.sample(&logits).map_err(|e| format!("sample error: {e}"))?;

        let mut all_gen_ids: Vec<u32> = vec![next_token];
        let mut prev_text_len = 0usize;
        let mut full_text = String::new();

        for step in 0..max_new_tokens {
            if EOS_TOKEN_IDS.contains(&next_token) {
                break;
            }

            let step_input = Tensor::new(&[next_token], &self.device)
                .and_then(|t| t.unsqueeze(0))
                .map_err(|e| format!("step tensor error: {e}"))?;

            let step_logits = self
                .model
                .forward(&step_input, prompt_len + step)
                .map_err(|e| format!("step forward error: {e}"))?;
            let step_logits = step_logits
                .squeeze(0)
                .and_then(|t| t.squeeze(0))
                .map_err(|e| format!("step logits error: {e}"))?;

            next_token = lp
                .sample(&step_logits)
                .map_err(|e| format!("step sample error: {e}"))?;
            all_gen_ids.push(next_token);

            // Decode incrementally — the tokenizer handles byte-pair boundaries
            match self.tokenizer.decode(&all_gen_ids, true) {
                Ok(current_text) => {
                    if current_text.len() > prev_text_len {
                        let new_piece = current_text[prev_text_len..].to_string();
                        on_token(new_piece.clone());
                        full_text.push_str(&new_piece);
                        prev_text_len = current_text.len();
                    }
                }
                Err(_) => {} // partial UTF-8 — wait for next token
            }
        }

        Ok(full_text)
    }
}

pub fn build_prompt(mode: &str, text: &str) -> String {
    match mode {
        "cleanup" => format!(
            "Clean up this voice transcript. Fix grammar, remove filler words (um, uh, like, you know), \
             fix punctuation, and improve readability. Keep the original meaning and speaker's tone intact. \
             Output only the cleaned text:\n\n{text}"
        ),
        "summary" => format!(
            "Summarize the following transcript in 3-5 concise sentences. Capture only the key points:\n\n{text}"
        ),
        "bullets" => format!(
            "Convert the following transcript into clear, concise bullet points. \
             Each bullet should be a distinct key point or action item. Use • as the bullet character:\n\n{text}"
        ),
        "email" => format!(
            "Convert the following voice transcript into a professional email. \
             Include: Subject line, greeting, concise body paragraphs, and a sign-off. \
             Format it ready to send:\n\n{text}"
        ),
        _ => text.to_string(),
    }
}

fn best_device() -> Device {
    #[cfg(target_os = "macos")]
    {
        if let Ok(d) = Device::new_metal(0) {
            log::info!("[ai] Metal GPU available — using GPU acceleration");
            return d;
        }
        log::info!("[ai] Metal not available — falling back to CPU");
    }
    Device::Cpu
}
