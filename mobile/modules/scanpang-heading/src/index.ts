import { requireNativeModule, EventEmitter, Subscription } from 'expo-modules-core';

const ScanPangHeadingModule = requireNativeModule('ScanPangHeading');
const emitter = new EventEmitter(ScanPangHeadingModule);

export function startWatching(): void {
  ScanPangHeadingModule.startWatching();
}

export function stopWatching(): void {
  ScanPangHeadingModule.stopWatching();
}

export function addHeadingListener(
  callback: (event: { heading: number }) => void
): Subscription {
  return emitter.addListener('onHeadingUpdate', callback);
}
