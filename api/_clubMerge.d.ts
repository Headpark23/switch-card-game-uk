export interface ClubDoc { name: string; nameAt: number; profiles: any[]; nights: any[]; seasons: any[]; removed: string[] }
export const MAX_PROFILES: number;
export const MAX_NIGHTS: number;
export const MAX_SEASONS: number;
export const MAX_REMOVED: number;
export function isShareable(item: unknown): boolean;
export function mergeClub(a: Partial<ClubDoc> | null | undefined, b: Partial<ClubDoc> | null | undefined): ClubDoc;
