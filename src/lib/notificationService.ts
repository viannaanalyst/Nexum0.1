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
    type: 'assignment' | 'comment' | 'status' | 'mention' | 'approval' = 'assignment'
) => {
    try {
        // 1. Check user notification preferences
        const { data: settings, error: settingsError } = await supabase
            .from('user_notification_settings')
            .select('*')
            .eq('user_id', recipientId)
            .single();

        if (settingsError && settingsError.code !== 'PGRST116') {
            console.error('Error fetching settings:', settingsError);
        }

        // 2. Decide if we should notify based on type
        let shouldNotify = true;
        if (settings) {
            switch (type) {
                case 'assignment':
                    shouldNotify = settings.new_tasks;
                    break;
                case 'comment':
                    shouldNotify = settings.comments;
                    break;
                case 'status':
                    shouldNotify = settings.status_changes;
                    break;
                case 'approval':
                    shouldNotify = settings.approvals;
                    break;
                case 'mention':
                    shouldNotify = settings.comments; // Mention goes into comments settings
                    break;
                // Add more cases as needed
            }
        }

        if (!shouldNotify) return { success: true, message: 'Settings disabled' };

        // 3. Send the notification
        return sendNotification({
            user_id: recipientId,
            title,
            description,
            type,
            metadata: { task_id: taskId }
        });
    } catch (error) {
        console.error('Error in createTaskNotification:', error);
        return { success: false, error };
    }
};
