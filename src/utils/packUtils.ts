/**
 * Pack (تەک / کۆتە) helpers shared by POS and Exchanges, so a pack is always
 * priced and counted the same way everywhere.
 */

export const getPackSize = (p: any): number => Math.max(1, Number(p?.packSize) || 1);

export const hasPack = (p: any): boolean => getPackSize(p) > 1;

/** Pack selling price. Falls back to unit price × pack size so a pack is never sold at the unit price. */
export const getPackPrice = (p: any): number =>
  Number(p?.wholesalePrice) > 0 ? Number(p.wholesalePrice) : (Number(p?.price) || 0) * getPackSize(p);

/** Pack cost. Falls back to unit cost × pack size. */
export const getPackCost = (p: any): number =>
  Number(p?.wholesaleCost) > 0 ? Number(p.wholesaleCost) : (Number(p?.costPrice) || 0) * getPackSize(p);

/** Product fields for adding one pack of `p` to a cart/sale line. */
export const asPackLine = (p: any) => {
  const packPrice = getPackPrice(p);
  return { ...p, price: packPrice, wholesalePrice: packPrice, wholesaleCost: getPackCost(p), isWholesale: true };
};
