export type HomeShowcaseModel = {
  id: string;
  name: string;
  category: string;
  /** Set to `/showcase/your-model.png` when ready. */
  imageSrc?: string;
};

export const HOME_SHOWCASE_MODELS: HomeShowcaseModel[] = [
  { id: 'airpod-case', name: 'AirPod Case', category: 'CONSUMER ELECTRONICS' },
  { id: 'rear-shock-clevis', name: 'Rear Shock Upper Clevis Mount', category: 'AUTOMOTIVE' },
  { id: 'suspension-assembly', name: '4-Link Suspension Assembly', category: 'AUTOMOTIVE' },
  { id: 'controller-link', name: 'Controller Link', category: 'ROBOTICS' },
  { id: 'iphone-wallet', name: 'iPhone 17 Snap-on Wallet Case', category: 'CONSUMER ELECTRONICS' },
];
