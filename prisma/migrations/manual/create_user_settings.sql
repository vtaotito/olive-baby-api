-- Migration: Create User Settings Table
-- Date: 2024-12-30
-- Description: Adiciona tabela para configurações do usuário (notificações, aparência, etc.)

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    
    -- Notification preferences
    push_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    email_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    sound_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    
    -- Quiet hours
    quiet_hours_enabled BOOLEAN DEFAULT FALSE NOT NULL,
    quiet_hours_start VARCHAR(5) DEFAULT '22:00' NOT NULL,
    quiet_hours_end VARCHAR(5) DEFAULT '07:00' NOT NULL,
    
    -- Routine notifications (JSON for flexibility)
    routine_notifications JSONB DEFAULT '{"feeding":true,"sleep":true,"diaper":false,"bath":true,"extraction":false}' NOT NULL,
    
    -- Appearance
    theme VARCHAR(20) DEFAULT 'system' NOT NULL,
    language VARCHAR(10) DEFAULT 'pt-BR' NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Foreign key
    CONSTRAINT fk_user_settings_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
);

-- Create index on user_id
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Add comment
COMMENT ON TABLE user_settings IS 'User preferences for notifications and appearance';

