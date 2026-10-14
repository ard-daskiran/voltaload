// Test oturumu: sunucuya başlat/durdur istekleri, Socket.io canlı akışı ve sayfa yenilenince yeniden bağlanma.
// Socket.io kütüphanesi index.html'de normal script olarak yüklenir (global "io").

import { apiErrorMessage } from "../core/api-error.js";

// onConnectionLost(testRunning) / onConnectionRestored(): Volta'yla canlı bağlantı koptu / kuruldu
export function createTestSession({ onWindow, onDone, onError, onConnectionLost, onConnectionRestored }) {
    const socket = io();

    let activeTestRunId = null;
    let backfilling = false; // Yeniden bağlanırken geçmiş dilimler işlenene kadar canlı paketleri beklet
    let pendingWindows = [];
    let lastElapsed = 0; // Yeniden bağlanırken aynı dilimin iki kez işlenmesini önler

    function dispatch(d) {
        lastElapsed = Math.max(lastElapsed, d.elapsedSeconds);
        onWindow(d);
    }

    function join(testRunId) {
        activeTestRunId = testRunId;
        lastElapsed = 0;
        socket.emit("join-test", testRunId);
    }

    // --- Socket.io ---

    socket.on("progress", (d) => {
        if (!activeTestRunId) return;
        if (backfilling) {
            pendingWindows.push(d);
            return;
        }
        dispatch(d);
    });

    socket.on("done", (data) => {
        if (!activeTestRunId) return;
        activeTestRunId = null;
        onDone(data?.status);
    });

    socket.on("error", (data) => {
        if (!activeTestRunId) return;
        activeTestRunId = null;
        onError(apiErrorMessage(data, "error.TEST_UNEXPECTED_ERROR"));
    });

    // Bağlantı kısa süreliğine koparsa Socket.io kendiliğinden yeniden bağlanır, odaya tekrar katıl
    socket.on("connect", () => {
        if (activeTestRunId) socket.emit("join-test", activeTestRunId);
        onConnectionRestored?.();
    });

    // Volta kapandı ya da bağlantı koptu (Socket.io arka planda yeniden bağlanmayı dener)
    socket.on("disconnect", () => {
        onConnectionLost?.(Boolean(activeTestRunId));
    });

    // --- Dışarıya açık fonksiyonlar ---

    // Testi başlatır. Başarılıysa { ok: true, testRunId }, değilse { ok: false, error } ya da { ok: false, unreachable: true }
    async function start(payload) {
        let response;
        try {
            response = await fetch("/api/test-run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
        } catch (err) {
            // İstek hiç gidemedi: Volta kapalı
            console.error(err);
            return { ok: false, unreachable: true };
        }

        // Cevap geldi ama JSON değilse (beklenmez) bu "ulaşılamadı" değil, "başlatılamadı"
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.testRunId) {
            return { ok: false, error: apiErrorMessage(data, "error.START_FAILED") };
        }
        return { ok: true, testRunId: data.testRunId };
    }

    // Başlatılan testin canlı akışını dinlemeye başla (ekran hazırlandıktan sonra çağrılır)
    function follow(testRunId) {
        join(testRunId);
    }

    // Durdurma isteği. Arayüz, sunucudan gelen "done" mesajıyla kilidi açar.
    async function stop() {
        if (!activeTestRunId) return { ok: true };
        try {
            await fetch(`/api/test-run/${activeTestRunId}/stop`, { method: "POST" });
            return { ok: true };
        } catch (err) {
            console.error(err);
            return { ok: false };
        }
    }

    // Sayfa açılınca çalışan bir test varsa ona yeniden bağlan.
    // onActive(active): ekranı hazırlamak için, dilimler işlenmeden önce çağrılır.
    // Dönüş: "none" (çalışan test yok), "resumed" (bağlanıldı), "finished" (bu arada bitmiş)
    async function resume(onActive) {
        let active = null;

        try {
            const response = await fetch("/api/test-run/active");
            ({ active } = await response.json());
        } catch {
            return "none";
        }

        if (!active) return "none";

        onActive(active);

        // Önce odaya katıl ve canlı paketleri beklet, sonra o ana kadarki dilimleri işle, en son bekleyenleri
        backfilling = true;
        pendingWindows = [];
        join(active.testRunId);

        try {
            const response = await fetch(`/api/test-run/${active.testRunId}/live`);
            const { windows } = await response.json();
            for (const w of windows) dispatch(w);
        } catch (err) {
            console.error("Geçmiş dilimler alınamadı:", err);
        } finally {
            backfilling = false;
            // Doldurmanın zaten kapsadığı canlı paketleri atla
            const cutoff = lastElapsed;
            for (const w of pendingWindows) {
                if (w.elapsedSeconds > cutoff) dispatch(w);
            }
            pendingWindows = [];
        }

        // Bu arada test bittiyse "done" mesajı kaçmış olabilir, kontrol et
        try {
            const response = await fetch("/api/test-run/active");
            const { active: stillActive } = await response.json();
            if (!stillActive || stillActive.testRunId !== active.testRunId) {
                activeTestRunId = null;
                return "finished";
            }
        } catch {
            // Sunucuya ulaşılamadıysa canlı akış zaten durumu bildirecek
        }

        return "resumed";
    }

    return { start, follow, stop, resume };
}