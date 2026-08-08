import { useTranslation } from 'react-i18next';

/**
 * 中 / EN 双标签语言切换按钮。
 * 仅在首页右上角显示。
 */
export function LanguageSwitcher() {
    const { i18n } = useTranslation();
    const current = i18n.language;

    const baseBtn =
        'rounded-full px-3 py-1 text-xs font-semibold transition-all';
    const activeBtn =
        'bg-gradient-to-r from-cyan-600 to-sky-500 text-white shadow-md shadow-cyan-900/30';
    const idleBtn = 'text-slate-300 hover:text-white';

    return (
        <div className="inline-flex items-center gap-1 rounded-full border border-[#30363D] bg-[#111827]/70 p-1 backdrop-blur-sm">
            <button
                type="button"
                onClick={() => i18n.changeLanguage('zh-CN')}
                className={`${baseBtn} ${current === 'zh-CN' ? activeBtn : idleBtn}`}
                aria-pressed={current === 'zh-CN'}
            >
                中
            </button>
            <button
                type="button"
                onClick={() => i18n.changeLanguage('en-US')}
                className={`${baseBtn} ${current === 'en-US' ? activeBtn : idleBtn}`}
                aria-pressed={current === 'en-US'}
            >
                EN
            </button>
        </div>
    );
}

export default LanguageSwitcher;
