"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";

interface TypewriterProps {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
  cursorClassName?: string;
}

export const Typewriter = ({
  text,
  speed = 30,
  delay = 0,
  className = "",
  cursorClassName = "bg-teal-700",
}: TypewriterProps) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!text) return;

    let index = 0;
    let timeout: NodeJS.Timeout;

    const typeNextCharacter = () => {
      if (index < text.length) {
        setDisplayedText(text.substring(0, index + 1));
        index++;
        timeout = setTimeout(typeNextCharacter, speed);
      } else {
        setIsComplete(true);
      }
    };

    const startTimeout = setTimeout(typeNextCharacter, delay);

    return () => {
      clearTimeout(timeout);
      clearTimeout(startTimeout);
    };
  }, [text, speed, delay]);

  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={className}
    >
      {displayedText}
      {!isComplete && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className={`inline-block w-0.5 h-5 ml-1 ${cursorClassName}`}
        />
      )}
    </motion.p>
  );
};
