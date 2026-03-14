/**
 * Robustly parses a list of answers (correct answers or student answers).
 * Handles:
 * 1. Actual arrays
 * 2. Proper JSON arrays as strings (e.g. '["A", "B"]')
 * 3. Comma-separated strings (e.g. 'A,B,C,')
 * 4. Null/Undefined
 */
export const parseRespostas = (data: any): string[] => {
    if (!data) return [];
    
    // If it's already an array, return it
    if (Array.isArray(data)) return data;

    // If it's a string, try to parse or split
    if (typeof data === 'string') {
        const trimmed = data.trim();
        if (!trimmed) return [];

        // Check if it looks like a JSON array
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                return JSON.parse(trimmed);
            } catch (e) {
                console.warn('Failed to parse JSON string, falling back to split:', trimmed);
            }
        }

        // Handle comma-separated list, filtering out empty entries (like trailing commas)
        return trimmed.split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }

    // Fallback
    console.warn('Unexpected data type for Antworten:', typeof data, data);
    return [];
};
