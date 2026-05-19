class SocketSubscription {
  constructor({ status, plan_name, daily_limit, today_usage } = {}) {
    this.status = status ?? null;
    this.planName = plan_name ?? null;
    this.dailyLimit = daily_limit ?? null;
    this.todayUsage = today_usage ?? null;
  }

  static fromJson(json) {
    return new SocketSubscription(json ?? {});
  }
}

class SocketUser {
  constructor({
    id,
    user_id,
    user_name,
    type,
    token,
    conversation_id,
    assistant_type_id,
    system_prompt,
    get_greeting_msg,
    mac_address,
    macAddress,
    timezone,
    subscription,
  } = {}) {
    this.id = id ?? null;
    this.userId = user_id ?? null;
    this.userName = user_name ?? null;
    this.type = type ?? "mobile"; // 'mobile' | 'robot'
    this.token = token ?? null;   // "Bearer xxxxx" — prefix already included
    this.conversationId = conversation_id ?? null;
    this.assistantTypeId = assistant_type_id ?? null;
    this.systemPrompt = system_prompt ?? "";
    this.getGreetingMsg = get_greeting_msg ?? true;
    this.macAddress = mac_address ?? macAddress ?? null;
    this.timezone = timezone ?? null;
    this.subscription = SocketSubscription.fromJson(subscription);
  }

  static fromJson(json) {
    return new SocketUser(json ?? {});
  }
}

module.exports = { SocketUser, SocketSubscription };
