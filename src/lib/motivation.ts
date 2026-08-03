
export type MotivationQuote = {
  text: string
  author: string
}

export const MOTIVATION_QUOTES: MotivationQuote[] = [
  {
    text: "Bizni bezovta qiladigan narsa voqealarning o'zi emas, balki ular haqidagi talqinimizdir.",
    author: "Epictetus"
  },
  {
    text: "To'siq yo'lni to'smaydi. To'siqning o'zi yo'lga aylanadi.",
    author: "Marcus Aurelius"
  },
  {
    text: "Kimning 'nega'si bo'lsa, deyarli har qanday 'qanday'ga chiday oladi.",
    author: "Friedrich Nietzsche"
  },
  {
    text: "Eng katta xavf — juda baland maqsad qo'yib unga yetolmaslik emas. Juda past maqsad qo'yib unga yetib olish.",
    author: "Michelangelo"
  },
  {
    text: "Erkinlik tashqaridan boshlanmaydi. U o'zingizni boshqara olishingizdan boshlanadi.",
    author: "Epictetus"
  },
  {
    text: "Ko'p odamlar haqiqatni qidirmaydi. Ular o'z fikrini tasdiqlaydigan dalillarni qidiradi.",
    author: "Unknown"
  },
  {
    text: "Agar sizning fikringizni hamma ma'qullayotgan bo'lsa, ehtimol siz yetarlicha chuqur o'ylamayapsiz.",
    author: "Unknown"
  },
  {
    text: "Inson ikki marta yashaydi. Ikkinchi hayoti esa faqat bitta hayoti borligini anglaganida boshlanadi.",
    author: "Confucius"
  },
  {
    text: "Qulay hayot kuchli odamlarni yaratmaydi.",
    author: "Unknown"
  },
  {
    text: "Og'riq muqarrar. Azob esa tanlovdir.",
    author: "Haruki Murakami"
  },
  {
    text: "Agar hamma bilan bir xil o'ylayotgan bo'lsangiz, demak siz o'ylamayapsiz.",
    author: "General Patton"
  },
  {
    text: "Qanchalik kam narsaga muhtoj bo'lsangiz, shunchalik boy odamsiz.",
    author: "Socrates"
  },
  {
    text: "Siz nazorat qila olmaydigan narsalar haqida qayg'urayotgan har bir daqiqa nazorat qila oladigan narsalaringizni yo'qotasiz.",
    author: "Stoic principle"
  },
  {
    text: "Har bir inson uchta hayot kechiradi: omma biladigan hayot, yaqinlari biladigan hayot va faqat o'zi biladigan hayot.",
    author: "Unknown"
  },
  {
    text: "Aqlni yo'qotish uchun ko'p narsa kerak emas. Faqat uni ishlatmay qo'yish kifoya.",
    author: "Unknown"
  },
  {
    text: "Odamlar vaqtni tejash uchun shoshilishadi, keyin esa topgan vaqtini nima qilishni bilmaydi.",
    author: "Seneca"
  },
  {
    text: "Hech narsa qilmayotgan odam ham qaror qabul qilmoqda.",
    author: "Unknown"
  },
  {
    text: "Maqsadga erishganingizdan keyin oladigan narsangizdan ko'ra, unga erishish jarayonida kimga aylanganingiz muhimroq.",
    author: "Zig Ziglar"
  },
  {
    text: "Sokin dengiz hech qachon mohir dengizchini tarbiyalamaydi.",
    author: "English proverb"
  },
  {
    text: "O'lim emas, behuda yashash qo'rqinchlidir.",
    author: "Seneca"
  },
  {
    text: "Ba'zan eng to'g'ri qaror eng yoqimsiz qaror bo'ladi.",
    author: "Unknown"
  },
  {
    text: "Qobiliyat eshikni ochadi. Xarakter esa uni ochiq ushlab turadi.",
    author: "Unknown"
  },
  {
    text: "Har bir odat avval o'rgimchak to'ridek nozik bo'ladi, keyin esa zanjirga aylanadi.",
    author: "Spanish proverb"
  },
  {
    text: "Ko'pchilik erkinlikni xohlaydi, lekin uning narxi bo'lgan mas'uliyatni emas.",
    author: "Jordan Peterson"
  },
  {
    text: "Yutqazgan odam emas, o'rganishni to'xtatgan odam mag'lub bo'ladi.",
    author: "Unknown"
  }
];

export function quoteOfTheDay(at: Date = new Date()): MotivationQuote {
  const start = Date.UTC(at.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((at.getTime() - start) / 86_400_000)
  return MOTIVATION_QUOTES[dayOfYear % MOTIVATION_QUOTES.length]
}
