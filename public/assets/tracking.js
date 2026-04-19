/* NaTV — Rastreamento Google Ads + Analytics
   Centralizado para todas as páginas. Não modificar datas, hashes ou comentários de debug aqui.
*/
(function () {
  'use strict';

  var GA_ID  = 'G-4L4PL12CWG';
  var AW_ID  = 'AW-987590909';
  var AW_LABEL = 'AW-987590909/yWZtCNz51ZccEP3h9dYD';

  /* ── Inicializa gtag ─────────────────────────────────────── */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', AW_ID);
  gtag('config', GA_ID);

  /* ── Helpers ─────────────────────────────────────────────── */
  function safeUrl(url) {
    try { return new URL(url, window.location.origin).toString(); }
    catch (_) { return String(url || ''); }
  }

  function inferPlan(url) {
    var v = decodeURIComponent(String(url || '')).toLowerCase();
    if (v.includes('básico') || v.includes('basico')) return 'basico';
    if (v.includes('completo'))   return 'completo';
    if (v.includes('trimestral')) return 'trimestral';
    if (v.includes('semestral'))  return 'semestral';
    if (v.includes('anual'))      return 'anual';
    if (v.includes('teste'))      return 'teste_gratis';
    if (v.includes('indicado'))   return 'indicacao';
    return 'geral';
  }

  /* ── Conversão principal ─────────────────────────────────── */
  function trackWhatsAppClick(url, meta) {
    meta = meta || {};
    var target = safeUrl(url);
    var plan   = meta.plan || inferPlan(target);
    var opened = false;

    function open() {
      if (opened || !target) return;
      opened = true;
      window.open(target, '_blank', 'noopener,noreferrer');
    }

    gtag('event', 'generate_lead', {
      currency: 'BRL', value: 1,
      method: 'WhatsApp',
      event_category: 'engagement',
      event_label: plan,
      plan_name: plan,
      contact_channel: 'whatsapp',
      page_location: window.location.href,
      send_to: GA_ID
    });

    gtag('event', 'click', {
      event_category: 'whatsapp',
      event_label: target,
      link_url: target,
      outbound: true,
      plan_name: plan,
      source: meta.source || 'site',
      send_to: GA_ID
    });

    gtag('event', 'conversion', {
      send_to: AW_LABEL,
      event_callback: open
    });

    setTimeout(open, 450);
    return false;
  }

  window.trackWhatsAppClick = trackWhatsAppClick;
  /* alias legado */
  window.gtag_report_conversion = trackWhatsAppClick;
})();
