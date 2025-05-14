// import React from 'react';
// import styled, { keyframes } from 'styled-components';

// // Keyframes for dot animation (simple bounce)
// const bounce = keyframes`
//   0%, 60%, 100% {
//     transform: translateY(0);
//   }
//   30% {
//     transform: translateY(-4px);
//   }
// `;

// // Styled components
// const BubbleContainer = styled.div`
//   display: inline-flex;
//   align-items: flex-end; // Align dots to bottom for bounce effect
//   padding: 6px 8px; // Adjusted padding
//   background-color: #e5e5ea; // iMessage-like grey bubble color
//   border-radius: 16px;
//   height: 24px; // Fixed height to contain bounce
//   box-sizing: border-box;
// `;

// const Dot = styled.div<{ delay: string }>`
//   width: 8px;
//   height: 8px;
//   margin: 0 2px;
//   background-color: #8e8e93; // iMessage-like dot color
//   border-radius: 50%;
//   animation: ${bounce} 1.2s infinite ease-in-out;
//   animation-delay: ${(props) => props.delay};
// `;

// // Component
// const AssistantTypingBubble: React.FC = () => {
//   return (
//     <BubbleContainer>
//       <Dot delay="0s" />
//       <Dot delay="0.2s" />
//       <Dot delay="0.4s" />
//     </BubbleContainer>
//   );
// };

// export default AssistantTypingBubble;
