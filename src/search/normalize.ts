export const normalize = (text: string) => text.normalize('NFKC').toLocaleLowerCase();
