import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react'
import MarkdownRenderer from './MarkdownRenderer'

export interface AnimatedMessageProps {
  content: string;
  isUserMessage: boolean;
  isComplete: boolean;
  onComplete: () => void;
  isHistoryMessage?: boolean;
  messageId?: string;
  conversationId?: string;
}

interface TypingState {
  isTyping: boolean;
  content: string;
  fullContent: string;
  index: number;
}

// Memoize plant message detection function
const isPlantIdentificationMessage = (content: string) => {
  return content.includes('Plant Identification Results') || 
         content.includes('Plant Health Assessment') ||
         content.includes('Plant Details') ||
         content.includes('Growing Requirements') ||
         (content.includes('plant') && content.includes('analyzed'));
}

const AnimatedMessage = memo(function AnimatedMessage({ 
  content, 
  isUserMessage, 
  isComplete, 
  onComplete,
  isHistoryMessage = false,
  messageId,
  conversationId
}: AnimatedMessageProps) {
  
  // Memoize expensive calculations
  const isPlantMessage = useMemo(() => 
    isPlantIdentificationMessage(content), 
    [content]
  )
  
  const shouldAnimate = useMemo(() => 
    !isUserMessage && !isComplete && (!isHistoryMessage || isPlantMessage),
    [isUserMessage, isComplete, isHistoryMessage, isPlantMessage]
  )

  // Track if we've called onComplete to avoid multiple calls
  const completionCalled = useRef(false);
  
  const [typingState, setTypingState] = useState<TypingState>({
    isTyping: shouldAnimate,
    content: shouldAnimate ? '' : content,
    fullContent: content,
    index: shouldAnimate ? 0 : content.length
  });

  // Memoize the optimal chars per tick calculation
  const getOptimalCharsPerTick = useCallback((length: number, isPlant: boolean) => {
    if (isPlant) {
      return length > 1000 ? 5 : 3;
    }
    return length > 500 ? 3 : 2;
  }, [])

  // Handle initial setup and content changes only
  useEffect(() => {
    completionCalled.current = false;
    
    if (isUserMessage || isComplete || (isHistoryMessage && !isPlantMessage)) {
      setTypingState({
        isTyping: false,
        content: content,
        fullContent: content,
        index: content.length
      });
      
      if (!isUserMessage && !isComplete && isHistoryMessage && !isPlantMessage) {
        completionCalled.current = true;
        onComplete();
      }
      return;
    }
    
    setTypingState({
      isTyping: true,
      content: '',
      fullContent: content,
      index: 0
    });
  }, [content, isUserMessage, isComplete, isHistoryMessage, isPlantMessage, onComplete]);

  // Handle the typing animation
  useEffect(() => {
    if (!shouldAnimate || !typingState.isTyping) {
      return;
    }
    
    const typingSpeed = 10;
    const charsPerTick = getOptimalCharsPerTick(typingState.fullContent.length, isPlantMessage);
    
    if (typingState.index < typingState.fullContent.length) {
      const timer = setTimeout(() => {
        const endIndex = Math.min(typingState.index + charsPerTick, typingState.fullContent.length);
        const newChars = typingState.fullContent.substring(typingState.index, endIndex);
        const isFinished = endIndex >= typingState.fullContent.length;
        
        setTypingState(prev => ({
          ...prev,
          content: prev.content + newChars,
          index: endIndex,
          isTyping: !isFinished
        }));
        
        if (isFinished && !completionCalled.current) {
          completionCalled.current = true;
          onComplete();
        }
      }, typingSpeed);
      
      return () => clearTimeout(timer);
    }
  }, [typingState.isTyping, typingState.index, typingState.fullContent, shouldAnimate, isPlantMessage, getOptimalCharsPerTick, onComplete]);

  return (
    <MarkdownRenderer 
      content={typingState.content} 
      isUserMessage={isUserMessage}
      isAnimating={typingState.isTyping}
      messageId={messageId}
      conversationId={conversationId}
    />
  );
})

export default AnimatedMessage