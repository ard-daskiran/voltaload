// Sunucudan gelen hatayı kullanıcının dilinde metne çevirir.
// Sunucu { error, code, params } gönderir: kod sözlükte varsa onun metni, yoksa sunucunun (İngilizce) yedek metni.

import { t } from "./i18n.js";

// data: sunucunun cevap gövdesi (okunamadıysa boş nesne)
// fallbackKey: ne kod ne yedek metin varsa gösterilecek sözlük anahtarı
export function apiErrorMessage(data, fallbackKey) {
    if (data?.code) {
        const key = `error.${data.code}`;
        const text = t(key, data.params ?? {});
        // t(), sözlükte olmayan anahtar için anahtarın kendisini döndürür
        if (text !== key) return text;
    }
    return data?.error ?? t(fallbackKey);
}