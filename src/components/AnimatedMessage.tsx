import { useState, useEffect, useRef } from 'react'
import MarkdownRenderer from './MarkdownRenderer'

export interface AnimatedMessageProps {
  content: string;
  isUserMessage: boolean;
  isComplete: boolean;
  onComplete: () => void;
  isHistoryMessage?: boolean;  // New prop to indicate if message was loaded from history
}

interface TypingState {
  isTyping: boolean;
  content: string;
  fullContent: string;
  index: number;
}

export default function AnimatedMessage({ 
  content, 
  isUserMessage, 
  isComplete, 
  onComplete,
  isHistoryMessage = false  // Default to false (new messages)
}: AnimatedMessageProps) {  // Decide if this message should animate
  // Only animate if: it's an assistant message (including plant.id responses) + not complete + not from history
  // Special handling for plant identification and followup messages to ensure they always animate
  // Use a more reliable detection - check for Plant.id specific headers/phrases  // Reliable detection of plant identification responses
  const isPlantMessage = content.includes('Plant Identification Results') || 
                        content.includes('Plant Health Assessment') ||
                        content.includes('Plant Details') ||
                        content.includes('Growing Requirements') ||
                        (content.includes('plant') && content.includes('analyzed'));
  
  // Always animate AI messages that aren't complete yet, 
  // and also animate plant messages even if they're marked as history
  const shouldAnimate = !isUserMessage && !isComplete && 
                      (!isHistoryMessage || isPlantMessage);
  
  // Simplified logging - only when debugging is needed
  if (!isUserMessage) {
    console.log('Assistant message animation:', { 
      shouldAnimate,
      isComplete,
      isHistoryMessage,
      isPlantMessage,
      contentStart: content.substring(0, 50)
    });
  }
    // Track if we've called onComplete to avoid multiple calls
  const completionCalled = useRef(false);
  
  const [typingState, setTypingState] = useState<TypingState>({
    isTyping: shouldAnimate,
    content: shouldAnimate ? '' : content,
    fullContent: content,
    index: shouldAnimate ? 0 : content.length
  });  // Handle initial setup and content changes only - separating from the animation effect
  useEffect(() => {
    // Reset completion flag when content changes
    completionCalled.current = false;    // Check if this is a plant message that should animate even if marked as history    const isPlantMessage = content.includes('Plant Identification Results') || 
                        content.includes('Plant Health Assessment') ||
                        content.includes('Plant Details') ||
                        content.includes('Growing Requirements') ||
                        (content.includes('plant') && content.includes('analyzed'));
                        
    // For messages that shouldn't animate: user messages, already completed, or from history (unless plant message)
    if (isUserMessage || isComplete || (isHistoryMessage && !isPlantMessage)) {
      setTypingState({
        isTyping: false,
        content: content,
        fullContent: content,
        index: content.length
      });
      
      // Mark non-user messages as complete if they're from history (unless plant message)
      if (!isUserMessage && !isComplete && isHistoryMessage && !isPlantMessage) {
        completionCalled.current = true;
        onComplete();
      }
      return;
    }
    
    // For new assistant messages that should animate - only reset when content changes
    setTypingState({
      isTyping: true,
      content: '',
      fullContent: content,
      index: 0
    });
    // This effect should only run when the content itself changes or animation parameters change
  }, [content, isUserMessage, isComplete, isHistoryMessage]);// Handle the typing animation - completely separate from the content setup effect
  useEffect(() => {
    // Skip animation entirely if not needed
    if (!shouldAnimate || !typingState.isTyping) {
      return;
    }
    
    // Faster typing speed - reduced from 20ms to 10ms
    const typingSpeed = 10; // Twice as fast
    
    // Handle plant messages to ensure they animate at an appropriate speed
    // Increase the characters per tick for faster animation
    const getOptimalCharsPerTick = (length: number) => {
      const isPlantMsg = content.includes('Plant Identification Results') || 
                         content.includes('Plant Health Assessment');
                         
      if (isPlantMsg) {
        return length > 1000 ? 5 : 3; // Much faster for plant messages
      }
      
      return length > 500 ? 3 : 2; // Faster for all other messages too
    };
    
    const charsPerTick = getOptimalCharsPerTick(typingState.fullContent.length);
    
    // Only set a timer if we still have characters left to type
    if (typingState.index < typingState.fullContent.length) {
      const timer = setTimeout(() => {
        // Calculate how many characters to add and the new index
        const endIndex = Math.min(typingState.index + charsPerTick, typingState.fullContent.length);
        const newChars = typingState.fullContent.substring(typingState.index, endIndex);
        const isFinished = endIndex >= typingState.fullContent.length;
        
        setTypingState(prev => ({
          ...prev,
          content: prev.content + newChars,
          index: endIndex,
          // Mark as not typing only when we reach the end
          isTyping: !isFinished
        }));
        
        // Signal completion when we're done typing (only once)
        if (isFinished && !completionCalled.current) {
          completionCalled.current = true;
          onComplete();
        }
      }, typingSpeed);
      
      return () => clearTimeout(timer);
    }
  }, [typingState.isTyping, typingState.index, typingState.fullContent, content, onComplete, shouldAnimate]);  // We'll use the isAnimating prop instead of directly modifying content

  return (
    <MarkdownRenderer 
      content={typingState.content} 
      isUserMessage={isUserMessage}
      isAnimating={typingState.isTyping}
    />
  );
}
