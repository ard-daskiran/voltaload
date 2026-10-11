// Grafiğin animasyon döngüsü: perde ve eksenin yavaşça büyümesi.
// Noktalar hiç hareket etmez. Akış hissini iki şey verir:
//   1) Perde: görünür alanın sağ kenarı bir önceki noktadan yeni noktaya doğru ilerler.
//   2) Eksen: tavan büyüyünce yeni değerine yavaşça kayar.
// İkisi tek bir döngüde çalışır, birbirine karışmaz.

import { Y_AXIS } from "./chart-theme.js";

export function createChartAnimator() {
    let chart = null;
    let frame = null;

    const reveal = { from: 0, to: 0, start: 0, duration: 0 };
    const yAxis = { from: Y_AXIS.min, to: Y_AXIS.min, start: 0 };

    // Perdenin şu an hangi zamana kadar açık olduğu (saniye cinsinden)
    function revealedX() {
        if (reveal.duration <= 0) return reveal.to;
        const progress = Math.min(1, (performance.now() - reveal.start) / reveal.duration);
        return reveal.from + (reveal.to - reveal.from) * progress;
    }

    function isRevealing() {
        return performance.now() - reveal.start < reveal.duration;
    }

    // Eksenin şu anki tavanı (kaymanın sonuna doğru yavaşlar)
    function currentYAxisMax() {
        const progress = Math.min(1, (performance.now() - yAxis.start) / Y_AXIS.animationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        return yAxis.from + (yAxis.to - yAxis.from) * eased;
    }

    function isYAxisMoving() {
        return performance.now() - yAxis.start < Y_AXIS.animationMs;
    }

    function requestFrame() {
        if (frame === null) frame = requestAnimationFrame(animateFrame);
    }

    function animateFrame() {
        frame = null;
        if (!chart) return;

        const axisMoving = isYAxisMoving();
        const targetMax = currentYAxisMax();

        if (axisMoving || chart.options.scales.y.max !== targetMax) {
            // Eksen değişiyor: ölçeği yeniden hesaplat
            chart.options.scales.y.max = targetMax;
            chart.update("none");
        } else {
            // Sadece perde ilerliyor: yeniden çizmek yeterli
            chart.draw();
        }

        if (axisMoving || isRevealing()) requestFrame();
    }

    // Yeni grafik kurulunca bağlanır
    function attach(newChart) {
        chart = newChart;
    }

    function reset() {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
        chart = null;

        reveal.from = 0;
        reveal.to = 0;
        reveal.start = 0;
        reveal.duration = 0;

        yAxis.from = Y_AXIS.min;
        yAxis.to = Y_AXIS.min;
        yAxis.start = 0;
    }

    // Perdeyi yeni noktaya doğru aç.
    // continueFromCurrent: önceki açılma bitmeden yenisi gelirse kaldığı yerden devam et (sıçrama olmasın)
    function revealTo(toX, durationMs, continueFromCurrent) {
        reveal.from = continueFromCurrent ? revealedX() : toX;
        reveal.to = toX;
        reveal.start = performance.now();
        reveal.duration = durationMs;
        requestFrame();
    }

    // En yüksek değer tavanı aşıyorsa tavanı yavaşça büyüt. Hiç küçültme.
    function growYAxis(peak) {
        const target = Math.min(Y_AXIS.cap, Math.max(Y_AXIS.min, Math.ceil((peak * Y_AXIS.headroom) / 10) * 10));
        if (target <= yAxis.to) return;

        yAxis.from = currentYAxisMax();
        yAxis.to = target;
        yAxis.start = performance.now();
        requestFrame();
    }

    return { attach, reset, revealTo, revealedX, growYAxis, currentYAxisMax };
}