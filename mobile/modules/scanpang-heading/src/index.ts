import { requireNativeModule, EventEmitter, Subscription } from 'expo-modules-core';

const ScanPangHeadingModule = requireNativeModule('ScanPangHeading');
const emitter = new EventEmitter(ScanPangHeadingModule);

export function startWatching(): void {
  ScanPangHeadingModule.startWatching();
}

export function stopWatching(): void {
  ScanPangHeadingModule.stopWatching();
}

// GPS 좌표 전달 → 자기편차(declination) 계산
export function setLocation(lat: number, lng: number, alt: number): void {
  ScanPangHeadingModule.setLocation(lat, lng, alt);
}

export function addHeadingListener(
  callback: (event: { heading: number }) => void
): Subscription {
  return emitter.addListener('onHeadingUpdate', callback);
}
