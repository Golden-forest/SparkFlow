// i18next 同步初始化
// 所有翻译 JSON 通过 Vite import.json bundled，零网络请求
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// zh-CN
import zhCommon from './locales/zh-CN/common.json';
import zhHome from './locales/zh-CN/home.json';
import zhHydrogen from './locales/zh-CN/experiments/hydrogen-transitions.json';
import zhRutherford from './locales/zh-CN/experiments/rutherford-scattering.json';
import zhCapacitor from './locales/zh-CN/experiments/capacitor-charge-discharge.json';
import zhRefraction from './locales/zh-CN/experiments/light-refraction.json';
import zhDoubleSlit from './locales/zh-CN/experiments/double-slit-interference.json';
import zhBoyle from './locales/zh-CN/experiments/boyle-law.json';
import zhSolar from './locales/zh-CN/experiments/solar-system.json';
import zhPendulum from './locales/zh-CN/experiments/pendulum.json';
import zhMotion from './locales/zh-CN/experiments/motion-collision.json';
import zhProjectile from './locales/zh-CN/experiments/projectile-motion.json';
import zhCircular from './locales/zh-CN/experiments/uniform-circular-motion.json';
import zhInclined from './locales/zh-CN/experiments/inclined-plane-friction.json';
import zhSpring from './locales/zh-CN/experiments/spring-oscillation.json';
import zhMomentum from './locales/zh-CN/experiments/momentum-carts.json';
import zhSynchrotron from './locales/zh-CN/experiments/synchrotron-em-fields.json';
import zhGalvanic from './locales/zh-CN/experiments/galvanic-cell.json';

// en-US
import enCommon from './locales/en-US/common.json';
import enHome from './locales/en-US/home.json';
import enHydrogen from './locales/en-US/experiments/hydrogen-transitions.json';
import enRutherford from './locales/en-US/experiments/rutherford-scattering.json';
import enCapacitor from './locales/en-US/experiments/capacitor-charge-discharge.json';
import enRefraction from './locales/en-US/experiments/light-refraction.json';
import enDoubleSlit from './locales/en-US/experiments/double-slit-interference.json';
import enBoyle from './locales/en-US/experiments/boyle-law.json';
import enSolar from './locales/en-US/experiments/solar-system.json';
import enPendulum from './locales/en-US/experiments/pendulum.json';
import enMotion from './locales/en-US/experiments/motion-collision.json';
import enProjectile from './locales/en-US/experiments/projectile-motion.json';
import enCircular from './locales/en-US/experiments/uniform-circular-motion.json';
import enInclined from './locales/en-US/experiments/inclined-plane-friction.json';
import enSpring from './locales/en-US/experiments/spring-oscillation.json';
import enMomentum from './locales/en-US/experiments/momentum-carts.json';
import enSynchrotron from './locales/en-US/experiments/synchrotron-em-fields.json';
import enGalvanic from './locales/en-US/experiments/galvanic-cell.json';

const savedLang = localStorage.getItem('sparkflow.lang') || 'zh-CN';

void i18n.use(initReactI18next).init({
    resources: {
        'zh-CN': {
            common: zhCommon,
            home: zhHome,
            'experiments.hydrogen-transitions': zhHydrogen,
            'experiments.rutherford-scattering': zhRutherford,
            'experiments.capacitor-charge-discharge': zhCapacitor,
            'experiments.light-refraction': zhRefraction,
            'experiments.double-slit-interference': zhDoubleSlit,
            'experiments.boyle-law': zhBoyle,
            'experiments.solar-system': zhSolar,
            'experiments.pendulum': zhPendulum,
            'experiments.motion-collision': zhMotion,
            'experiments.projectile-motion': zhProjectile,
            'experiments.uniform-circular-motion': zhCircular,
            'experiments.inclined-plane-friction': zhInclined,
            'experiments.spring-oscillation': zhSpring,
            'experiments.momentum-carts': zhMomentum,
            'experiments.synchrotron-em-fields': zhSynchrotron,
            'experiments.galvanic-cell': zhGalvanic,
        },
        'en-US': {
            common: enCommon,
            home: enHome,
            'experiments.hydrogen-transitions': enHydrogen,
            'experiments.rutherford-scattering': enRutherford,
            'experiments.capacitor-charge-discharge': enCapacitor,
            'experiments.light-refraction': enRefraction,
            'experiments.double-slit-interference': enDoubleSlit,
            'experiments.boyle-law': enBoyle,
            'experiments.solar-system': enSolar,
            'experiments.pendulum': enPendulum,
            'experiments.motion-collision': enMotion,
            'experiments.projectile-motion': enProjectile,
            'experiments.uniform-circular-motion': enCircular,
            'experiments.inclined-plane-friction': enInclined,
            'experiments.spring-oscillation': enSpring,
            'experiments.momentum-carts': enMomentum,
            'experiments.synchrotron-em-fields': enSynchrotron,
            'experiments.galvanic-cell': enGalvanic,
        },
    },
    lng: savedLang,
    fallbackLng: 'zh-CN',
    defaultNS: 'common',
    interpolation: { escapeValue: false },
});

// 包装 changeLanguage，同步写入 localStorage
const originalChangeLanguage = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = async (lng?: string) => {
    const result = await originalChangeLanguage(lng);
    if (lng) {
        localStorage.setItem('sparkflow.lang', lng);
    }
    return result;
};

export default i18n;
