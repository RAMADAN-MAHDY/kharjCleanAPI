import dotenv from "dotenv";
import UserRequest from "../models/UserRequest.js";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.OPENAI_API_KEY });

const ChatController = async (req, res) => {
    const { message } = req.clonedBody;
    const sessionId = req.sessionId;
    const token = req.token;

    if (!message) {
        return res.status(400).json({ error: "الرسالة مطلوبة" });
    }
    if (message === "ابدأ") {
        return res.status(200).json({ reply: "✨ اهلا 👋 محتاج اي مساعده ", token });
    }

    try {
        let userSession = await UserRequest.findOne({ sessionId });

        if (!userSession) {
            userSession = await UserRequest.create({
                sessionId,
                chatHistory: [
                    {
                        role: "user",
                        content: `
أنت مساعد ذكي لخدمات تنظيف المنازل والمكاتب، لديك المعلومات التالية:

- خدمات التنظيف:
1. تنظيف تكييفات
2. تنظيف غرف
3.تنظيف ركنيات وسجاد
4.مجالس
5.هي خدمة نظافه عامة 

- أوقات الحجز المتاحة: من 9 صباحًا إلى 11 مساء

- المناطق المتاحة: الخرج، الرياض

📌 هدفك هو:
- مساعدة العميل في اختيار نوع الخدمة
- تحديد التاريخ والوقت
- معرفة اسمه
- معرفة رقم جواله للتواصل

✅ لا تطلب من العميل الضغط على زر "تم" إلا إذا كان كتب:
- نوع الخدمة
- الموقع
- التاريخ
- الوقت
- اسمه
- رقم الجوال

🛑 لو العميل ما كتب رقم جواله، لا تطلب منه تأكيد الحجز، وبلّغه إن لازم يكتب رقم الجوال علشان نكمل.

💬 كن ودود وواضح، ورد باللهجة السعودية دائمًا، واستخدم إيموجيات مناسبة في ردودك.

-  اذ طلب اي شي مش موجود هنا قوله يتصل علي الرقم ده 0562790402

اذا تم تاكيد الحجز واستلمت كل البيانات قله يضغط على زر "تم الاتفاق" عشان يتم الحجز

💡📝 اكتب الرد بصيغة Markdown فقط، ولا تستخدم أي علامات ترقيم غير Markdown. 
- اجعل كل سطر يحتوي على سطر جديد (line break) 
- لا تدمج النقاط كلها في سطر واحد 
- اجعل كل فقرة واضحة ومقسمة بشكل سهل القراءة. 
`.trim()

                    },
                ],
            });

            return res.json({
                reply: `هلا فيك! 😊  
وش نوع الخدمة اللي تبغاها؟  
عندي خدمات تنظيف للمكيفات  
الغرف  
الركنيات  
السجاد  
والمجالس  

🕘 الأوقات: من 9 صباحًا إلى 11 مساء  
📍 المناطق: الرياض والخرج  

💬 اكتب لي نوع الخدمة أو استفسارك، وأنا حاضر أخدمك 😄`,
                token,
            });
        }

        // ✨ تحديث التاريخ
        userSession.chatHistory.push({ role: "user", content: message });

        // ✨ تحويل history لصيغة Gemini
        const formattedHistory = userSession.chatHistory.slice(-20).map(msg => ({
            role:
                msg.role === "assistant"
                    ? "model"
                    : msg.role === "system"
                        ? "user" // ✨ أي system تتحول لـ user
                        : msg.role, // أي user يفضل user
            parts: [{ text: msg.content }],
        }));

        // ✨ استدعاء Gemini
        const completion = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: formattedHistory,
            generationConfig: {
                maxOutputTokens: 200
            }
        });

        let reply = completion.text || "";

        if (!reply) {
            return res.status(500).json({ error: "ما قدرناش نرجع رد من المساعد" });
        }
        const stopSequences = ["END"]; // ممكن تزود هنا اللي انت عايزه
        for (const stop of stopSequences) {
            if (reply.includes(stop)) {
                reply = reply.split(stop)[0].trim();
                break;
            }
        }

        if (!reply) {
            return res.status(500).json({ error: "ما قدرناش نرجع رد من المساعد" });
        }

        userSession.chatHistory.push({ role: "assistant", content: reply });
        await userSession.save();

        res.json({ reply, token });
    } catch (error) {
        console.error("❌ خطأ في استدعاء gemini:", error);
        res.status(500).json({ error: "حدث خطأ داخلي" });
    }
};

export default ChatController;
