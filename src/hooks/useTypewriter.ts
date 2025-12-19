'use client';

import { useState, useEffect } from 'react';

interface UseTypewriterOptions {
  words: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
}

export function useTypewriter({
  words,
  typingSpeed = 50,
  deletingSpeed = 30,
  pauseDuration = 2000,
}: UseTypewriterOptions) {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (words.length === 0) return;

    const currentWord = words[currentWordIndex];

    const handleTyping = () => {
      if (isPaused) {
        // Wait during pause
        const pauseTimeout = setTimeout(() => {
          setIsPaused(false);
          setIsDeleting(true);
        }, pauseDuration);
        return () => clearTimeout(pauseTimeout);
      }

      if (!isDeleting && currentText === currentWord) {
        // Finished typing current word, pause before deleting
        setIsPaused(true);
        return;
      }

      if (isDeleting && currentText === '') {
        // Finished deleting, move to next word
        setIsDeleting(false);
        setCurrentWordIndex((prev) => (prev + 1) % words.length);
        return;
      }

      // Type or delete character
      const timeout = setTimeout(
        () => {
          if (isDeleting) {
            setCurrentText((prev) => prev.slice(0, -1));
          } else {
            setCurrentText((prev) => currentWord.slice(0, prev.length + 1));
          }
        },
        isDeleting ? deletingSpeed : typingSpeed
      );

      return () => clearTimeout(timeout);
    };

    return handleTyping();
  }, [currentText, currentWordIndex, isDeleting, isPaused, words, typingSpeed, deletingSpeed, pauseDuration]);

  return currentText;
}

