# OSCAR - AI Voice Notes

Turn your voice into clear, formatted text using AI. Just talk, and OSCAR handles the rest.

## Features

- 🎤 **Speak Freely** - Just talk naturally. No need to worry about formatting.
- ⚡ **AI Formats** - Our AI transforms your words into clean, structured text.
- 📄 **Ready to Use** - Copy, edit, or download your polished notes instantly.

## Getting Started

### Prerequisites

- Node.js 18+ installed
- The `stt-tts-lib-0.1.0.tgz` package file in the project root

### Installation

1. Install dependencies:
```bash
npm install
```

2. Make sure the `stt-tts-lib-0.1.0.tgz` file is in the project root directory.

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. Click "Start Recording" to begin recording your voice.
2. Speak naturally - the app will capture your audio.
3. Click "Stop Recording" when finished.
4. The app will:
   - Convert your audio to text using `stt-tts-lib`
   - Format the text using AI
   - Display the formatted notes
5. You can then:
   - Edit the notes
   - Copy to clipboard
   - Download as a text file
   - Record again

## Project Structure

```
Oscar/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Homepage
│   ├── results/
│   │   └── page.tsx        # Results page
│   └── globals.css         # Global styles
├── components/
│   ├── RecordingButton.tsx # Recording button component
│   └── FeatureCard.tsx     # Feature card component
├── lib/
│   ├── audioToText.ts      # Audio to text conversion
│   └── aiFormatter.ts      # AI text formatting
└── package.json
```

## Configuration

### Audio-to-Text Library

The `stt-tts-lib-0.1.0.tgz` package is used for audio transcription. The integration is in `lib/audioToText.ts`. You may need to adjust the import and method calls based on the actual API of the package.

### AI Formatting

The AI formatting is currently using rule-based formatting. To use an actual AI service (like OpenAI), you can:

1. Add your API key to `.env.local`:
```
OPENAI_API_KEY=your_api_key_here
```

2. Update `lib/aiFormatter.ts` to use the `formatWithOpenAI` function instead of `formatTextWithRules`.

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Notes

- The audio recording uses the browser's MediaRecorder API
- Audio is recorded in WebM format
- The transcribed text and formatted notes are stored in sessionStorage
- Make sure to grant microphone permissions when prompted

# Oscar
# oscar
