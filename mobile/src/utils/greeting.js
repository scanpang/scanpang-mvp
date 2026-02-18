/**
 * 시간대별 인사 메시지
 */
export const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 6) return '새벽이에요!';
  if (hour < 12) return '좋은 아침이에요!';
  if (hour < 14) return '점심시간이에요!';
  if (hour < 18) return '좋은 오후에요!';
  if (hour < 22) return '좋은 저녁이에요!';
  return '늦은 밤이에요!';
};
