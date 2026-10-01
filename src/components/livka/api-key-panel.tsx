"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Flame,
  KeyRound,
  Send,
  Terminal,
  Cpu,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Zap,
  ArrowRight,
  Code2,
} from "lucide-react";
import type { SessionUser } from "@/components/livka/auth";
import type { TokenSnapshot } from "@/lib/tokens-shared";
import { balanceOf, formatTokens } from "@/lib/tokens-shared";
import { useW } from "@/components/livka/i18n-context";

export function ApiKeyPanel({
  user,
  tokens,
  onBuyTokens,
}: {
  user: SessionUser | null;
  tokens: TokenSnapshot;
  onBuyTokens: () => void;
}) {
  const { w, intl } = useW();
  const ks = w.keySection;

  const [revealed, setRevealed] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"cursor" | "claudeCode" | "python" | "node" | "curl">("cursor");
  const [sendingTg, setSendingTg] = useState(false);
  const [tgFeedback, setTgFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const apiKey = tokens.apiKey || "lvk-claude-demo-key-not-issued";
  const baseUrl = "https://api.livkamarket.app/v1";
  const messagesUrl = "https://api.livkamarket.app/v1/messages";
  const modelId = "claude-opus-5-5";

  // Balance calculation
  const opusModel = tokens.models.find((m) => m.slug === "opus-5-5" || m.slug === "claude-opus-5-5") ?? tokens.models[0];
  const owned = opusModel ? balanceOf(tokens, opusModel.slug) : null;
  const currentTokens = owned ? owned.inputTokens + owned.outputTokens : 0;

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "key") {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2500);
      } else {
        setCopiedField(type);
        setTimeout(() => setCopiedField(null), 2500);
      }
    } catch {
      // Fallback
    }
  };

  const handleSendTelegram = async () => {
    setSendingTg(true);
    setTgFeedback(null);
    try {
      const res = await fetch("/api/tokens/send-telegram", { method: "POST" });
      const data = await res.json() as { ok?: boolean; error?: string; sentToTelegram?: boolean; username?: string };
      if (res.ok && data.ok) {
        setTgFeedback({
          ok: true,
          msg: data.username
            ? `Ключ успешно отправлен в Telegram (@${data.username})!`
            : ks.tgSentSuccess,
        });
      } else {
        if (data.error === "TELEGRAM_NOT_LINKED") {
          setTgFeedback({
            ok: false,
            msg: "Ваш Telegram не найден в базе бота. Напишите боту @LivkaMarketBot команду /start или авторизуйтесь на сайте через Telegram.",
          });
        } else {
          setTgFeedback({
            ok: false,
            msg: data.error ?? "Не удалось отправить сообщение. Попробуйте позже.",
          });
        }
      }
    } catch {
      setTgFeedback({ ok: false, msg: "Ошибка связи с сервером." });
    } finally {
      setSendingTg(false);
    }
  };

  const codeSnippets = {
    cursor: `// Cursor / Windsurf / Cline / Continue Configuration:
// 1. Откройте Settings -> Models
// 2. Включите "Anthropic" override
// 3. Укажите:
Base URL:    https://api.livkamarket.app
API Key:     ${apiKey}
Model:       ${modelId}`,

    claudeCode: `# Claude Code CLI (Терминал / Bash / Zsh):
export ANTHROPIC_BASE_URL="https://api.livkamarket.app"
export ANTHROPIC_API_KEY="${apiKey}"

# Запустите Claude Code:
claude`,

    python: `import anthropic

client = anthropic.Anthropic(
    api_key="${apiKey}",
    base_url="https://api.livkamarket.app",
)

message = client.messages.create(
    model="${modelId}",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Привет! Напиши краткую справку по архитектуре REST API."}
    ],
)
print(message.content[0].text)`,

    node: `import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: "${apiKey}",
  baseURL: "https://api.livkamarket.app",
});

async function main() {
  const message = await anthropic.messages.create({
    model: "${modelId}",
    max_tokens: 1024,
    messages: [{ role: "user", content: "Привет! Напиши функцию генерации UUID на TypeScript." }],
  });
  console.log(message.content);
}

main();`,

    curl: `curl https://api.livkamarket.app/v1/messages \\
  -H "x-api-key: ${apiKey}" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "content-type: application/json" \\
  -d '{
    "model": "${modelId}",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Привет, Claude!"}
    ]
  }'`,
  };

  return (
    <div className="wk-key-panel">
      {/* Top Banner */}
      <section className="wk-key-hero">
        <div className="wk-key-hero-content">
          <div className="wk-key-tags">
            <span className="wk-key-badge active">
              <span className="wk-key-dot" /> {ks.badgeActive}
            </span>
            <span className="wk-key-badge model">
              <Cpu size={13} /> {ks.badgeModel}
            </span>
            <span className="wk-key-badge protocol">
              <Zap size={13} /> Anthropic Messages API
            </span>
          </div>
          <h2>{ks.title}</h2>
          <p>{ks.keyHint}</p>
        </div>
      </section>

      {/* Primary Key Box */}
      <section className="wk-key-box-card">
        <div className="wk-key-box-header">
          <div className="wk-key-box-label">
            <KeyRound size={17} />
            <span>{ks.keyLabel}</span>
          </div>
          <div className="wk-key-box-actions">
            <button
              type="button"
              className="wk-btn-pill"
              onClick={() => setRevealed(!revealed)}
              title={revealed ? ks.hide : ks.show}
            >
              {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
              <span>{revealed ? ks.hide : ks.show}</span>
            </button>
            <button
              type="button"
              className={`wk-btn-pill ${copiedKey ? "is-copied" : ""}`}
              onClick={() => copyToClipboard(apiKey, "key")}
            >
              {copiedKey ? <Check size={15} /> : <Copy size={15} />}
              <span>{copiedKey ? ks.copied : ks.copyKey}</span>
            </button>
          </div>
        </div>

        <div className="wk-key-input-container">
          <code className="wk-key-string">
            {revealed
              ? apiKey
              : apiKey.slice(0, 11) + "••••••••••••••••••••••••••••••••••••" + apiKey.slice(-4)}
          </code>
        </div>
        <div className="wk-key-security-note">
          <ShieldCheck size={14} />
          <span>Ключ привязан к вашему аккаунту и действует бессрочно при наличии токенов. Не передавайте его третьим лицам.</span>
        </div>
      </section>

      {/* Grid: Parameters, Balance, Telegram */}
      <div className="wk-key-meta-grid">
        {/* Connection Parameters */}
        <section className="wk-meta-card">
          <div className="wk-meta-head">
            <Layers size={17} />
            <h3>{ks.paramsTitle}</h3>
          </div>
          <div className="wk-param-rows">
            <div className="wk-param-row">
              <div>
                <small>{ks.baseUrlLabel}</small>
                <code>{baseUrl}</code>
              </div>
              <button
                type="button"
                className="wk-icon-copy-btn"
                onClick={() => copyToClipboard(baseUrl, "baseUrl")}
                title="Скопировать Base URL"
              >
                {copiedField === "baseUrl" ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>

            <div className="wk-param-row">
              <div>
                <small>{ks.endpointLabel}</small>
                <code>{messagesUrl}</code>
              </div>
              <button
                type="button"
                className="wk-icon-copy-btn"
                onClick={() => copyToClipboard(messagesUrl, "endpoint")}
                title="Скопировать Endpoint"
              >
                {copiedField === "endpoint" ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>

            <div className="wk-param-row">
              <div>
                <small>{ks.modelLabel}</small>
                <code>{modelId}</code>
              </div>
              <button
                type="button"
                className="wk-icon-copy-btn"
                onClick={() => copyToClipboard(modelId, "model")}
                title="Скопировать Model ID"
              >
                {copiedField === "model" ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </section>

        {/* Token Balance */}
        <section className="wk-meta-card">
          <div className="wk-meta-head">
            <Flame size={17} style={{ color: "#f59e0b" }} />
            <h3>{ks.tokensBalanceTitle}</h3>
          </div>
          <div className="wk-balance-showcase">
            <div className="wk-balance-val">
              <span>{ks.currentBalance}</span>
              <strong>{formatTokens(currentTokens, intl)}</strong>
            </div>
            <p className="wk-balance-sub">
              Расход списывается строго по факту генерации (входные и выходные токены).
            </p>
            <button type="button" className="wk-button wk-primary wk-full" onClick={onBuyTokens}>
              <Flame size={16} /> {ks.buyMore} <ArrowRight size={16} />
            </button>
          </div>
        </section>

        {/* Telegram Sync */}
        <section className="wk-meta-card wk-telegram-card">
          <div className="wk-meta-head">
            <Send size={17} style={{ color: "#38bdf8" }} />
            <h3>{ks.tgTitle}</h3>
          </div>
          <div className="wk-tg-content">
            <div className="wk-tg-status">
              <span className={`wk-status-pill ${user?.telegramId ? "linked" : "unlinked"}`}>
                {user?.telegramId ? "● Привязан" : "○ Не привязан"}
              </span>
              <p>
                {user?.telegramId
                  ? ks.tgConnected(user.telegramUsername || user.name)
                  : ks.tgNotConnected}
              </p>
            </div>
            <p className="wk-tg-desc">
              {user?.telegramId ? ks.tgConnectedDesc : ks.tgNotConnectedDesc}
            </p>

            <button
              type="button"
              className="wk-button wk-secondary wk-full wk-tg-btn"
              disabled={sendingTg}
              onClick={handleSendTelegram}
            >
              <Send size={15} />
              {sendingTg ? ks.tgSending : ks.tgSendBtn}
            </button>

            {tgFeedback && (
              <div className={`wk-tg-alert ${tgFeedback.ok ? "is-ok" : "is-err"}`}>
                {tgFeedback.ok ? <Check size={14} /> : <Sparkles size={14} />}
                <span>{tgFeedback.msg}</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Integration Guides & Code Tabs */}
      <section className="wk-code-guides">
        <div className="wk-guides-head">
          <div className="wk-guides-title">
            <Code2 size={20} />
            <h3>{ks.quickstartTitle}</h3>
          </div>
          <div className="wk-guide-tabs" role="tablist">
            <button
              type="button"
              className={`wk-tab-btn ${activeTab === "cursor" ? "is-active" : ""}`}
              onClick={() => setActiveTab("cursor")}
            >
              {ks.tabCursor}
            </button>
            <button
              type="button"
              className={`wk-tab-btn ${activeTab === "claudeCode" ? "is-active" : ""}`}
              onClick={() => setActiveTab("claudeCode")}
            >
              {ks.tabClaudeCode}
            </button>
            <button
              type="button"
              className={`wk-tab-btn ${activeTab === "python" ? "is-active" : ""}`}
              onClick={() => setActiveTab("python")}
            >
              {ks.tabPython}
            </button>
            <button
              type="button"
              className={`wk-tab-btn ${activeTab === "node" ? "is-active" : ""}`}
              onClick={() => setActiveTab("node")}
            >
              {ks.tabNode}
            </button>
            <button
              type="button"
              className={`wk-tab-btn ${activeTab === "curl" ? "is-active" : ""}`}
              onClick={() => setActiveTab("curl")}
            >
              {ks.tabCurl}
            </button>
          </div>
        </div>

        <div className="wk-code-container">
          <div className="wk-code-toolbar">
            <span className="wk-code-lang">
              <Terminal size={14} /> {activeTab}
            </span>
            <button
              type="button"
              className="wk-btn-copy-code"
              onClick={() => copyToClipboard(codeSnippets[activeTab], activeTab)}
            >
              {copiedField === activeTab ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedField === activeTab ? ks.copied : "Скопировать код"}</span>
            </button>
          </div>
          <pre className="wk-code-content">
            <code>{codeSnippets[activeTab]}</code>
          </pre>
        </div>
      </section>
    </div>
  );
}
