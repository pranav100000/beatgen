export const prettyPrint = (name: string) => {
    const spacedName = name.replace(/[-_]/g, ' ');
    const words = spacedName.split(' ');
    const capitalizedWords = words.map(word => word.charAt(0).toUpperCase() + word.slice(1));
    return capitalizedWords.join(' ');
};