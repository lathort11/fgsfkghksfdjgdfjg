"use client";

import { useState, useRef } from "react";
import {
  ExternalLink,
  RotateCw,
  Maximize2,
  Minimize2,
  ShieldCheck,
  Cpu,
  LoaderCircle,
  Lock,
  Server,
  KeyRound,
  Network,
} from "lucide-react";
import { useA } from "@/components/livka/i18n-context";

export function AdminOmniroutePanel() {
  const { a } = useA();
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const reloadIframe = () => {
    setLoading(true);
    setKey((prev) => prev + 1);
  };

  const toggleFullscreen = () => {
    setFullscreen((prev) => !prev);
  };

  const dashboardUrl = "/omniroute/dashboard";

  return (
    <div className={`ad-omniroute-wrapper ${fullscreen ? "fullscreen" : ""}`}>
      {/* Top action & status bar */}
      <section className="ad-card ad-omniroute-bar">
        <div className="ad-omniroute-info">
          <div className="ad-omniroute-icon">
            <Cpu size={22} />
          </div>
          <div>
            <div className="ad-omniroute-title-row">
              <h2>OmniRoute AI Gateway</h2>
              <span className="ad-status active">
                <span className="ad-dot-pulse" />
                Порт 20128 · Онлайн
              </span>
            </div>
            <p className="ad-omniroute-subtitle">
              Центр управления AI-провайдерами, маршрутизацией запросов, токенами и системными логами
            </p>
          </div>
        </div>

        <div className="ad-omniroute-actions">
          <button
            type="button"
            className="ad-btn-secondary"
            onClick={reloadIframe}
            title="Перезагрузить интерфейс"
          >
            <RotateCw size={14} className={loading ? "ad-spin" : ""} />
            <span>Перезагрузить</span>
          </button>

          <button
            type="button"
            className="ad-btn-secondary"
            onClick={toggleFullscreen}
            title={fullscreen ? "Свернуть" : "На весь экран"}
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{fullscreen ? "Свернуть" : "Во весь экран"}</span>
          </button>

          <a
            href={dashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ad-btn-primary"
            title="Открыть дашборд в отдельной вкладке"
          >
            <ExternalLink size={14} />
            <span>Открыть во вкладке</span>
          </a>
        </div>
      </section>

      {/* Security Info Card */}
      <div className="ad-omniroute-banner">
        <div className="ad-omniroute-banner-item">
          <ShieldCheck size={16} className="text-emerald" />
          <span><b>Защита периметра:</b> Доступ закрыт от внешнего интернета и проверяется Caddy + сессией администратора LIVKA CONTROL.</span>
        </div>
        <div className="ad-omniroute-banner-item">
          <Lock size={16} className="text-amber" />
          <span><b>Вход в шлюз:</b> При первом открытии используйте мастер-пароль OmniRoute.</span>
        </div>
      </div>

      {/* Embedded Iframe Container */}
      <div className="ad-card ad-omniroute-frame-container">
        {loading && (
          <div className="ad-omniroute-loading">
            <LoaderCircle className="ad-spin" size={32} />
            <b>Загрузка интерфейса OmniRoute…</b>
            <span>Подключение к внутреннему сервису omniroute:20128</span>
          </div>
        )}

        <iframe
          key={key}
          ref={iframeRef}
          src={dashboardUrl}
          title="OmniRoute AI Gateway Dashboard"
          className="ad-omniroute-iframe"
          onLoad={() => setLoading(false)}
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}
