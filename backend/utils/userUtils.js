/**
 * Generates a username in the format: first initial + surname.
 * Normalizes to lowercase and removes non-alphanumeric characters.
 * 
 * Examples:
 * "Mpazamiso Ndebele" -> "mndebele"
 * "M. Ndebele" -> "mndebele"
 * "John Michael Doe" -> "jdoe" (Uses the last part as surname)
 */
function generateUsername(name) {
    if (!name) return '';

    // Replace dots with spaces to ensure initials are treated as parts
    const sanitizedInput = name.replace(/\./g, ' ');

    // Split by spaces, hyphens, and remove empty parts
    const parts = sanitizedInput.split(/[\s-]+/).filter(p => p.length > 0);

    if (parts.length === 0) return '';

    const firstInitial = parts[0][0].toLowerCase();
    const surname = parts[parts.length - 1].toLowerCase();

    // Combine and remove all non-alphanumeric characters
    const combined = (firstInitial + surname).replace(/[^a-z0-9]/g, '');

    return combined;
}

module.exports = {
    generateUsername
};
