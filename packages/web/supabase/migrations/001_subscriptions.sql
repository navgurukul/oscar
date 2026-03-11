-- OSCAR Subscription System Database Schema
-- This migration creates tables for Razorpay payment integration

-- ============================================
-- 1. SUBSCRIPTIONS TABLE
-- ============================================
-- Stores user subscription information linked to Razorpay

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    razorpay_customer_id TEXT,
    razorpay_subscription_id TEXT UNIQUE,
    razorpay_plan_id TEXT,
    tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro')),
    billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly') OR billing_cycle IS NULL),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired', 'paused')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_subscription_id ON public.subscriptions(razorpay_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON public.subscriptions(tier);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscriptions
-- Users can read their own subscription
CREATE POLICY "Users can view their own subscription"
    ON public.subscriptions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own subscription (for initial free tier creation)
CREATE POLICY "Users can create their own subscription"
    ON public.subscriptions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Only service role can update subscriptions (webhook updates)
-- Note: Users cannot directly update their subscription tier
CREATE POLICY "Service role can update subscriptions"
    ON public.subscriptions
    FOR UPDATE
    USING (auth.role() = 'service_role');

-- ============================================
-- 2. USAGE TRACKING TABLE
-- ============================================
-- Tracks monthly recording usage per user

CREATE TABLE IF NOT EXISTS public.usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month_year TEXT NOT NULL, -- format: '2026-01'
    recording_count INTEGER NOT NULL DEFAULT 0 CHECK (recording_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, month_year)
);

-- Indexes for usage_tracking
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_month ON public.usage_tracking(user_id, month_year);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_month_year ON public.usage_tracking(month_year);

-- Enable RLS
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies for usage_tracking
-- Users can read their own usage
CREATE POLICY "Users can view their own usage"
    ON public.usage_tracking
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can insert/update usage (API routes handle this)
CREATE POLICY "Service role can insert usage"
    ON public.usage_tracking
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role' OR auth.uid() = user_id);

CREATE POLICY "Service role can update usage"
    ON public.usage_tracking
    FOR UPDATE
    USING (auth.role() = 'service_role' OR auth.uid() = user_id);

-- ============================================
-- 3. WEBHOOK EVENTS TABLE
-- ============================================
-- Stores processed webhook events for idempotency

CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razorpay_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT false,
    payload JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ
);

-- Indexes for webhook_events
CREATE INDEX IF NOT EXISTS idx_webhook_events_razorpay_event_id ON public.webhook_events(razorpay_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.webhook_events(created_at);

-- Enable RLS
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service role can access webhook events
CREATE POLICY "Service role can manage webhook events"
    ON public.webhook_events
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- 4. HELPER FUNCTIONS
-- ============================================

-- Function to get current month in YYYY-MM format
CREATE OR REPLACE FUNCTION get_current_month_year()
RETURNS TEXT AS $$
BEGIN
    RETURN to_char(NOW(), 'YYYY-MM');
END;
$$ LANGUAGE plpgsql;

-- Function to increment recording usage (upsert pattern)
CREATE OR REPLACE FUNCTION increment_recording_usage(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_month_year TEXT;
    v_new_count INTEGER;
BEGIN
    v_month_year := get_current_month_year();
    
    INSERT INTO public.usage_tracking (user_id, month_year, recording_count)
    VALUES (p_user_id, v_month_year, 1)
    ON CONFLICT (user_id, month_year)
    DO UPDATE SET 
        recording_count = usage_tracking.recording_count + 1,
        updated_at = now()
    RETURNING recording_count INTO v_new_count;
    
    RETURN v_new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get monthly usage
CREATE OR REPLACE FUNCTION get_monthly_usage(p_user_id UUID, p_month_year TEXT DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
    v_month_year TEXT;
    v_count INTEGER;
BEGIN
    v_month_year := COALESCE(p_month_year, get_current_month_year());
    
    SELECT recording_count INTO v_count
    FROM public.usage_tracking
    WHERE user_id = p_user_id AND month_year = v_month_year;
    
    RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update subscription updated_at timestamp
CREATE OR REPLACE FUNCTION update_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_subscriptions_timestamp
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_timestamp();

CREATE TRIGGER update_usage_tracking_timestamp
    BEFORE UPDATE ON public.usage_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_timestamp();

-- ============================================
-- 5. COMMENTS
-- ============================================

COMMENT ON TABLE public.subscriptions IS 'User subscription information for Razorpay payment integration';
COMMENT ON TABLE public.usage_tracking IS 'Monthly recording usage tracking per user';
COMMENT ON TABLE public.webhook_events IS 'Razorpay webhook events for idempotent processing';

COMMENT ON COLUMN public.subscriptions.tier IS 'Subscription tier: free or pro';
COMMENT ON COLUMN public.subscriptions.status IS 'Razorpay subscription status';
COMMENT ON COLUMN public.subscriptions.billing_cycle IS 'monthly or yearly billing';
COMMENT ON COLUMN public.usage_tracking.month_year IS 'Month in YYYY-MM format for tracking';
COMMENT ON COLUMN public.usage_tracking.recording_count IS 'Number of recordings created this month';
