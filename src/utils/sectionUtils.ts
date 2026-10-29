import { isShishaProduct } from './categoryUtils';

// The store sections. A product belongs to exactly one of them.
export type StoreSection = 'general' | 'shisha' | 'packet' | 'external';

export const SECTION_LABELS: Record<StoreSection, string> = {
  general: 'بەشی گشتی',
  shisha: 'بەشی شیشە',
  packet: 'بەشی پاکەت',
  external: 'کاڵای دەرەکی',
};

/** Firestore settings document that holds each section's own category list */
export const SECTION_CATEGORY_DOC: Partial<Record<StoreSection, string>> = {
  general: 'general_categories',
  shisha: 'shisha_categories',
  packet: 'packet_categories',
};

export const isPacketProduct = (p: any): boolean => p?.section === 'packet';

/** Which section a product is shown in (packet and external are decided by the stored section only) */
export const getProductSection = (p: any): StoreSection => {
  if (p?.section === 'external') return 'external';
  if (p?.section === 'packet') return 'packet';
  if (isShishaProduct(p)) return 'shisha';
  return 'general';
};

export const isProductInSection = (p: any, section: string): boolean => getProductSection(p) === section;
