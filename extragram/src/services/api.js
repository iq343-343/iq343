export const checkChannel = async (channelName) => {
    try {
        const response = await fetch(`/api/channel?name=${encodeURIComponent(channelName)}`);
        if (!response.ok) {
            throw new Error('Channel not found');
        }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};
