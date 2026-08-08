
import { getLocale } from "@/lib/i18n"
import type { Locale } from "@/lib/i18n"

export type MotivationQuote = {
  text: Record<Locale, string>
  author: string
}

export const MOTIVATION_QUOTES: MotivationQuote[] = [
  {
    text: {
      uz: "Bizni bezovta qiladigan narsa voqealarning o'zi emas, balki ular haqidagi talqinimizdir.",
      ru: "Нас тревожат не сами события, а наши суждения о них.",
      en: "Men are disturbed not by things, but by the views they take of them.",
    },
    author: "Epictetus"
  },
  {
    text: {
      uz: "To'siq yo'lni to'smaydi. To'siqning o'zi yo'lga aylanadi.",
      ru: "Препятствие не преграждает путь. Препятствие и становится путём.",
      en: "The obstacle does not block the path. What stands in the way becomes the way.",
    },
    author: "Marcus Aurelius"
  },
  {
    text: {
      uz: "Kimning 'nega'si bo'lsa, deyarli har qanday 'qanday'ga chiday oladi.",
      ru: "Тот, у кого есть «зачем» жить, вынесет почти любое «как».",
      en: "He who has a why to live can bear almost any how.",
    },
    author: "Friedrich Nietzsche"
  },
  {
    text: {
      uz: "Eng katta xavf — juda baland maqsad qo'yib unga yetolmaslik emas. Juda past maqsad qo'yib unga yetib olish.",
      ru: "Главная опасность не в том, чтобы поставить слишком высокую цель и не достичь её. А в том, чтобы поставить слишком низкую — и достичь.",
      en: "The greater danger is not in setting our aim too high and falling short. It is in setting our aim too low and reaching it.",
    },
    author: "Michelangelo"
  },
  {
    text: {
      uz: "Erkinlik tashqaridan boshlanmaydi. U o'zingizni boshqara olishingizdan boshlanadi.",
      ru: "Свобода начинается не снаружи. Она начинается с власти над собой.",
      en: "Freedom does not begin outside you. It begins with mastery over yourself.",
    },
    author: "Epictetus"
  },
  {
    text: {
      uz: "Ko'p odamlar haqiqatni qidirmaydi. Ular o'z fikrini tasdiqlaydigan dalillarni qidiradi.",
      ru: "Большинство людей ищет не истину. Они ищут доводы, подтверждающие их мнение.",
      en: "Most people are not looking for the truth. They are looking for evidence that confirms what they already believe.",
    },
    author: "Unknown"
  },
  {
    text: {
      uz: "Agar sizning fikringizni hamma ma'qullayotgan bo'lsa, ehtimol siz yetarlicha chuqur o'ylamayapsiz.",
      ru: "Если с вашим мнением согласны все, вероятно, вы думали недостаточно глубоко.",
      en: "If everyone agrees with your idea, you probably have not thought deeply enough.",
    },
    author: "Unknown"
  },
  {
    text: {
      uz: "Inson ikki marta yashaydi. Ikkinchi hayoti esa faqat bitta hayoti borligini anglaganida boshlanadi.",
      ru: "У человека две жизни. Вторая начинается тогда, когда он понимает, что жизнь одна.",
      en: "We have two lives. The second begins when we realize we have only one.",
    },
    author: "Confucius"
  },
  {
    text: {
      uz: "Qulay hayot kuchli odamlarni yaratmaydi.",
      ru: "Удобная жизнь не создаёт сильных людей.",
      en: "A comfortable life does not make strong people.",
    },
    author: "Unknown"
  },
  {
    text: {
      uz: "Og'riq muqarrar. Azob esa tanlovdir.",
      ru: "Боль неизбежна. Страдание — выбор.",
      en: "Pain is inevitable. Suffering is optional.",
    },
    author: "Haruki Murakami"
  },
  {
    text: {
      uz: "Agar hamma bilan bir xil o'ylayotgan bo'lsangiz, demak siz o'ylamayapsiz.",
      ru: "Если все думают одинаково, значит, кто-то не думает.",
      en: "If everyone is thinking alike, then somebody isn't thinking.",
    },
    author: "General Patton"
  },
  {
    text: {
      uz: "Qanchalik kam narsaga muhtoj bo'lsangiz, shunchalik boy odamsiz.",
      ru: "Чем меньше вам нужно, тем вы богаче.",
      en: "The fewer your wants, the richer you are.",
    },
    author: "Socrates"
  },
  {
    text: {
      uz: "Siz nazorat qila olmaydigan narsalar haqida qayg'urayotgan har bir daqiqa nazorat qila oladigan narsalaringizni yo'qotasiz.",
      ru: "Каждая минута тревоги о том, что вам неподвластно, — это минута, потерянная для того, что вам подвластно.",
      en: "Every minute you spend worrying about what you cannot control is a minute lost from what you can.",
    },
    author: "Stoic principle"
  },
  {
    text: {
      uz: "Har bir inson uchta hayot kechiradi: omma biladigan hayot, yaqinlari biladigan hayot va faqat o'zi biladigan hayot.",
      ru: "У каждого человека три жизни: та, которую знают все, та, которую знают близкие, и та, которую знает только он сам.",
      en: "Everyone lives three lives: the one the public knows, the one close friends know, and the one only they know.",
    },
    author: "Unknown"
  },
  {
    text: {
      uz: "Aqlni yo'qotish uchun ko'p narsa kerak emas. Faqat uni ishlatmay qo'yish kifoya.",
      ru: "Чтобы потерять разум, нужно немного. Достаточно перестать им пользоваться.",
      en: "It takes little to lose your mind. It is enough to stop using it.",
    },
    author: "Unknown"
  },
  {
    text: {
      uz: "Odamlar vaqtni tejash uchun shoshilishadi, keyin esa topgan vaqtini nima qilishni bilmaydi.",
      ru: "Люди спешат, чтобы сэкономить время, а потом не знают, что с ним делать.",
      en: "People hurry to save time, then do not know what to do with the time they saved.",
    },
    author: "Seneca"
  },
  {
    text: {
      uz: "Hech narsa qilmayotgan odam ham qaror qabul qilmoqda.",
      ru: "Тот, кто ничего не делает, тоже принимает решение.",
      en: "A person who does nothing is also making a decision.",
    },
    author: "Unknown"
  },
  {
    text: {
      uz: "Maqsadga erishganingizdan keyin oladigan narsangizdan ko'ra, unga erishish jarayonida kimga aylanganingiz muhimroq.",
      ru: "Важно не то, что вы получаете, достигнув цели, а то, кем вы становитесь на пути к ней.",
      en: "What you get by achieving your goals is not as important as what you become by achieving them.",
    },
    author: "Zig Ziglar"
  },
  {
    text: {
      uz: "Sokin dengiz hech qachon mohir dengizchini tarbiyalamaydi.",
      ru: "Спокойное море никогда не воспитывало умелого моряка.",
      en: "A smooth sea never made a skilled sailor.",
    },
    author: "English proverb"
  },
  {
    text: {
      uz: "O'lim emas, behuda yashash qo'rqinchlidir.",
      ru: "Страшна не смерть, а напрасно прожитая жизнь.",
      en: "It is not death that is frightening, but a life lived in vain.",
    },
    author: "Seneca"
  },
  {
    text: {
      uz: "Ba'zan eng to'g'ri qaror eng yoqimsiz qaror bo'ladi.",
      ru: "Иногда самое верное решение оказывается самым неприятным.",
      en: "Sometimes the right decision is the most unpleasant one.",
    },
    author: "Unknown"
  },
  {
    text: {
      uz: "Qobiliyat eshikni ochadi. Xarakter esa uni ochiq ushlab turadi.",
      ru: "Способности открывают дверь. Характер удерживает её открытой.",
      en: "Talent opens the door. Character keeps it open.",
    },
    author: "Unknown"
  },
  {
    text: {
      uz: "Har bir odat avval o'rgimchak to'ridek nozik bo'ladi, keyin esa zanjirga aylanadi.",
      ru: "Каждая привычка сначала тонка, как паутина, а затем становится цепью.",
      en: "Every habit begins as thin as a cobweb and ends as a chain.",
    },
    author: "Spanish proverb"
  },
  {
    text: {
      uz: "Ko'pchilik erkinlikni xohlaydi, lekin uning narxi bo'lgan mas'uliyatni emas.",
      ru: "Многие хотят свободы, но не ответственности, которая является её ценой.",
      en: "Most people want freedom, but not the responsibility that is its price.",
    },
    author: "Jordan Peterson"
  },
  {
    text: {
      uz: "Yutqazgan odam emas, o'rganishni to'xtatgan odam mag'lub bo'ladi.",
      ru: "Проигрывает не тот, кто потерпел поражение, а тот, кто перестал учиться.",
      en: "You are not defeated when you lose, but when you stop learning.",
    },
    author: "Unknown"
  }
];

export function quoteOfTheDay(at: Date = new Date()): { text: string; author: string } {
  const start = Date.UTC(at.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((at.getTime() - start) / 86_400_000)
  const quote = MOTIVATION_QUOTES[dayOfYear % MOTIVATION_QUOTES.length]
  return { text: quote.text[getLocale()], author: quote.author }
}
