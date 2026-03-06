import { supabase } from './supabase';

export interface NotificationData {
    user_id: string;
    title: string;
    description: string;
    type?: string;
    metadata?: any;
}

/**
 * Sends a notification to a specific user.
 */
export const sendNotification = async ({
    user_id,
    title,
    description,
    type = 'info',
    metadata = {}
}: NotificationData) => {
    try {
        const { error } = await supabase
            .from('notifications')
            .insert({
                user_id,
                title,
                description,
                type,
                metadata,
                unread: true
            });

        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Error sending notification:', error);
        return { success: false, error };
    }
};

/**
 * Specifically created for task-related notifications.
 */
export const createTaskNotification = async (
    recipientId: string,
    title: string,
    description: string,
    taskId: string,
    type: 'assignment' | 'comment' | 'status' | 'mention' = 'assignment'
) => {
    // Get current user to avoid self-notification (optional, but usually better)
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id === recipientId) return { success: true }; // Skip self-notification

    return sendNotification({
        user_id: recipientId,
        title,
        description,
        type,
        metadata: { task_id: taskId }
    });
};
