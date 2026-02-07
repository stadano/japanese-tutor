import React, { useState, useEffect, useRef } from "react";
import { 
  BookOpen, ChevronRight, ChevronLeft, X, Check, Trophy, 
  Brain, ThumbsUp, ThumbsDown, Zap, Loader2, 
  Calendar, BarChart3, Search, RefreshCw, CheckCircle 
} from "lucide-react";

/**
 * ====================================================================
 * MOCK DATA & SIMULATION (Replaces Anthropic API for Browser/Gemini)
 * ====================================================================
 */

const MOCK_GENERATED_ARTICLES = [
  {
    id: "art_gen_01",
    category: "ビジネス",
    catColor: "bg-green-600",
    title: "トヨタ、EV戦略を再編へ　全固体電池の実用化急ぐ",
    summary: "トヨタ自動車が電気自動車（EV）の生産計画を見直し、次世代電池の開発に資源を集中させる方針を固めた。",
    content: "{豊田章男|とよだあきお}会長は15日、株主総会で新たなEV戦略を発表した。世界的なEV需要の減速を受け、ハイブリッド車（HV）の販売を強化しつつ、2027年を目処に「全固体電池」を搭載した次世代EVの投入を目指す。これにより充電時間を現在の10分の1に短縮できる見込みだ。{佐藤恒治|さとうこうじ}社長は「マルチパスウェイ（全方位）戦略は維持するが、技術革新のスピードを上げる必要がある」と強調した。市場ではテスラや中国BYDとの競争が激化しており、技術的なブレイクスルーが急務となっている。",
    vocabWords: [
      { word: "再編", reading: "さいへん", meaning: "組織などを編成し直すこと" },
      { word: "全固体電池", reading: "ぜんこたいでんち", meaning: "安全で高性能な次世代電池" },
      { word: "実用化", reading: "じつようか", meaning: "実際に使えるようにすること" },
      { word: "目処", reading: "めど", meaning: "目指すところ、見通し" },
      { word: "急務", reading: "きゅうむ", meaning: "急いでなすべき任務" }
    ]
  },
  {
    id: "art_gen_02",
    category: "政治",
    catColor: "bg-red-600",
    title: "首相、少子化対策に3兆円規模　財源確保が焦点",
    summary: "政府は「異次元の少子化対策」の具体案を提示したが、社会保険料の増額に対する反発も予想される。",
    content: "{岸田文雄|きしだふみお}首相は記者会見で、児童手当の拡充や育休給付の引き上げを含む少子化対策の全容を明らかにした。予算規模は年間3兆円半ばとなる見通しだ。しかし、その財源として医療保険料に上乗せして徴収する「支援金制度」の導入が検討されており、現役世代の負担増に対する懸念が広がっている。野党の{立憲民主党|りっけんみんしゅとう}は「実質的な増税だ」と強く批判しており、国会での論戦が激化するのは必至だ。政府は国民の理解を得るため、丁寧な説明が求められる。",
    vocabWords: [
      { word: "少子化", reading: "しょうしか", meaning: "子供の数が減ること" },
      { word: "財源", reading: "ざいげん", meaning: "資金の出どころ" },
      { word: "焦点", reading: "しょうてん", meaning: "注目が集まる点" },
      { word: "拡充", reading: "かくじゅう", meaning: "広げて充実させること" },
      { word: "必至", reading: "ひっし", meaning: "必ずそうなること" }
    ]
  },
  {
    id: "art_gen_03",
    category: "テック・AI",
    catColor: "bg-blue-600",
    title: "国産生成AI、NTTが企業向け提供開始　セキュリティ重視",
    summary: "NTTが自社開発の大規模言語モデル「tsuzumi」の商用提供を開始。海外勢に対抗する。",
    content: "NTTは1日、独自に開発した生成AI「tsuzumi（つづみ）」のサービス提供を始めた。OpenAIの「ChatGPT」などに比べてパラメーター数を抑えることで、低コストかつ軽量に動作するのが特徴だ。また、学習データを日本語中心にすることで、日本特有の商習慣や文化への理解度を高めた。{島田明|しまだあきら}社長は「機密情報を扱う金融機関や自治体にとって、国内サーバーで完結する安心感は大きい」と述べる。AI覇権争いにおいて、国産モデルがどこまでシェアを伸ばせるか注目される。",
    vocabWords: [
      { word: "生成AI", reading: "せいせいえーあい", meaning: "文章や画像を作るAI" },
      { word: "商用", reading: "しょうよう", meaning: "商売に使うこと" },
      { word: "対抗", reading: "たいこう", meaning: "張り合うこと" },
      { word: "機密", reading: "きみつ", meaning: "極めて重要な秘密" },
      { word: "覇権", reading: "はけん", meaning: "競技などで優勝する権利" }
    ]
  },
  {
    id: "art_gen_04",
    category: "スタートアップ",
    catColor: "bg-orange-600",
    title: "宇宙ベンチャー「ispace」、月面着陸へ再挑戦",
    summary: "民間初の月面着陸を目指すispaceが、次期ランダーの打ち上げ計画を発表した。",
    content: "日本の宇宙スタートアップ企業{ispace|あいすぺーす}は、2度目となる月面着陸ミッションを2026年冬に行うと発表した。前回の失敗を教訓に、ソフトウェアの改良と着陸脚の強化を行っている。{袴田武史|はかまだたけし}CEOは「失敗は成功への過程に過ぎない。必ず成し遂げる」と決意を示した。成功すれば、民間企業としては世界初の快挙となり、月面資源開発への道が拓かれる。資金調達環境が厳しさを増す中、日本のディープテック企業の底力が試されている。",
    vocabWords: [
      { word: "着陸", reading: "ちゃくりく", meaning: "空から降りて陸に着くこと" },
      { word: "教訓", reading: "きょうくん", meaning: "失敗から学ぶこと" },
      { word: "過程", reading: "かてい", meaning: "物事が進む道筋" },
      { word: "快挙", reading: "かいきょ", meaning: "胸がすくような立派な行い" },
      { word: "資金調達", reading: "しきんちょうたつ", meaning: "事業のためのお金を集めること" }
    ]
  },
  {
    id: "art_gen_05",
    category: "国際情勢",
    catColor: "bg-purple-600",
    title: "米中首脳会談、台湾問題で平行線　対話継続では一致",
    summary: "サンフランシスコで行われた米中首脳会談は、具体的な成果に乏しい結果となった。",
    content: "{バイデン|ばいでん}米大統領と{習近平|しゅうきんぺい}国家主席による会談は、約4時間に及んだ。軍事対話の再開では合意したものの、最重要課題である台湾問題を巡っては双方の主張が対立したままだ。{習|しゅう}氏は「台湾は中国の一部であり、平和統一を目指す」と従来の立場を崩さず、米国による台湾への武器供与を強く批判した。一方、米国側は「現状変更には断固反対する」と牽制した。経済面でのデカップリング（切り離し）についても議論されたが、溝は埋まっていない。",
    vocabWords: [
      { word: "首脳", reading: "しゅのう", meaning: "政府や組織の中心人物" },
      { word: "平行線", reading: "へいこうせん", meaning: "意見が合わず妥協点がないこと" },
      { word: "乏しい", reading: "とぼしい", meaning: "足りない、少ない" },
      { word: "供与", reading: "きょうよ", meaning: "相手に利益などを与えること" },
      { word: "牽制", reading: "けんせい", meaning: "相手の行動をおさえること" }
    ]
  }
];

// Fallback vocab for quiz logic (as per spec)
const FALLBACK_VOCAB = [
  { word: "懸念", reading: "けねん", meaning: "気にかかって不安に思うこと" },
  { word: "措置", reading: "そち", meaning: "事態を解決するための取り計らい" },
  { word: "是正", reading: "ぜせい", meaning: "悪い点を改めて正しくすること" },
  { word: "包括的", reading: "ほうかつてき", meaning: "全体をひっくるめているさま" },
  { word: "抜本的", reading: "ばっぽんてき", meaning: "根本に立ち戻って行うさま" }
];

/**
 * ====================================================================
 * STORAGE & UTILS
 * ====================================================================
 */

// Mapping spec's window.storage to localStorage for browser compatibility
const K = {
  DAYS: "jpr-days-v1",
  VOCAB: "jpr-vocab-v1",
  FEEDBACK: "jpr-feedback-v1",
  ARTICLES: "jpr-articles-v1",
  PREFS: "jpr-prefs-v1",
  STREAK: "jpr-streak-v1"
};

const storage = {
  get: (key) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (e) { console.error("Storage Read Error", e); return null; }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { console.error("Storage Write Error", e); }
  }
};

const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * ====================================================================
 * MAIN APPLICATION
 * ====================================================================
 */

export default function App() {
  // === STATE ===
  // Phases: loading -> review-quiz -> home -> generating -> pick -> vocab-preview -> read -> session-quiz
  const [phase, setPhase] = useState("loading");
  
  // Persistent Data
  const [days, setDays] = useState([]);
  const [vocabBank, setVocabBank] = useState([]); // {word, reading, meaning, added}
  const [feedback, setFeedback] = useState([]);
  const [dailyArticles, setDailyArticles] = useState({ date: "", suggested: [], selected: [] });
  const [prefs, setPrefs] = useState({ likedTopics: [], dislikedTopics: [], notes: "" });
  
  // Session State
  const [reviewQuizData, setReviewQuizData] = useState(null);
  const [sessionQuizData, setSessionQuizData] = useState(null);
  const [currentArticleIndex, setCurrentArticleIndex] = useState(0);
  const [sessionUnknownWords, setSessionUnknownWords] = useState([]);
  const [sidebarLookupTerm, setSidebarLookupTerm] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [feedbackInput, setFeedbackInput] = useState("");
  const [feedbackMode, setFeedbackMode] = useState(null); // articleId for dislike comment
  
  const loadedRef = useRef(false);

  // === INITIALIZATION ===
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    
    // Load all data
    const d = storage.get(K.DAYS) || [];
    const v = storage.get(K.VOCAB) || [];
    const f = storage.get(K.FEEDBACK) || [];
    const a = storage.get(K.ARTICLES) || { date: "", suggested: [], selected: [] };
    const p = storage.get(K.PREFS) || { likedTopics: [], dislikedTopics: [], notes: "" };

    setDays(d);
    setVocabBank(v);
    setFeedback(f);
    setDailyArticles(a);
    setPrefs(p);

    const td = todayStr();
    
    // Logic: Determine Start Phase
    const hasReadToday = d.includes(td);
    
    if (hasReadToday) {
      setPhase("home"); // Already done for the day
    } else {
      // Check for review words (older than today)
      const reviewCandidates = v.filter(w => w.added !== td); 
      if (reviewCandidates.length > 0) {
        setupReviewQuiz(reviewCandidates);
      } else if (a.date === td && a.selected.length > 0) {
         // Resume session if articles already selected
        setPhase("home");
      } else {
        setPhase("home");
      }
    }
  }, []);

  // === PERSISTENCE HELPERS ===
  const persistVocab = (newVocab) => {
    setVocabBank(newVocab);
    storage.set(K.VOCAB, newVocab);
  };
  const persistDays = (newDays) => {
    setDays(newDays);
    storage.set(K.DAYS, newDays);
  };
  const persistArticles = (newArts) => {
    setDailyArticles(newArts);
    storage.set(K.ARTICLES, newArts);
  };
  const persistFeedback = (newFb) => {
    setFeedback(newFb);
    storage.set(K.FEEDBACK, newFb);
  };

  // === QUIZ LOGIC ===
  const generateQuiz = (words, sourcePool) => {
    return words.map(target => {
      // 3 distractors
      const distractors = sourcePool
        .filter(w => w.word !== target.word && w.meaning !== target.meaning)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);
      
      // If not enough distractors, fill from fallback
      while (distractors.length < 3) {
        const fallback = FALLBACK_VOCAB[Math.floor(Math.random() * FALLBACK_VOCAB.length)];
        if (!distractors.find(d => d.meaning === fallback.meaning) && fallback.meaning !== target.meaning) {
          distractors.push(fallback);
        }
      }

      const choices = [...distractors.map(d => d.meaning), target.meaning].sort(() => 0.5 - Math.random());
      
      return {
        ...target,
        choices,
        correctMeaning: target.meaning,
        userAnswer: null
      };
    });
  };

  const setupReviewQuiz = (candidates) => {
    const quizWords = candidates.sort(() => 0.5 - Math.random()).slice(0, 5); // Max 5 review words
    const qData = generateQuiz(quizWords, [...vocabBank, ...FALLBACK_VOCAB]);
    setReviewQuizData({ questions: qData, index: 0, score: 0 });
    setPhase("review-quiz");
  };

  const handleQuizAnswer = (answer, isReview) => {
    const quizState = isReview ? reviewQuizData : sessionQuizData;
    const setQuizState = isReview ? setReviewQuizData : setSessionQuizData;
    
    const currentQ = quizState.questions[quizState.index];
    const isCorrect = answer === currentQ.correctMeaning;
    
    const updatedQs = [...quizState.questions];
    updatedQs[quizState.index] = { ...currentQ, userAnswer: answer };
    
    setQuizState({
      ...quizState,
      questions: updatedQs,
      score: quizState.score + (isCorrect ? 1 : 0),
      index: quizState.index + 1 // Advance immediately (as per spec "single-click")
    });
  };

  const completeReviewQuiz = () => {
    // Process results: Correct -> Remove from Bank. Incorrect -> Keep.
    const correctWords = reviewQuizData.questions
      .filter(q => q.userAnswer === q.correctMeaning)
      .map(q => q.word);
    
    const newBank = vocabBank.filter(w => !correctWords.includes(w.word));
    persistVocab(newBank);
    setReviewQuizData(null);
    setPhase("home");
  };

  const setupSessionQuiz = () => {
    // Unknown words from this session + carry over
    const sessionWords = [...sessionUnknownWords];
    
    // Add some carry-over if we have few session words
    if (sessionWords.length < 5) {
      const carryOver = vocabBank.filter(w => !sessionWords.find(sw => sw.word === w.word)).slice(0, 5 - sessionWords.length);
      sessionWords.push(...carryOver);
    }

    if (sessionWords.length === 0) {
      finishDay(); // No words to quiz
      return;
    }

    // De-dupe
    const uniqueWords = Array.from(new Map(sessionWords.map(item => [item.word, item])).values());
    
    const qData = generateQuiz(uniqueWords, [...vocabBank, ...MOCK_GENERATED_ARTICLES[0].vocabWords, ...FALLBACK_VOCAB]);
    setSessionQuizData({ questions: qData, index: 0, score: 0 });
    setPhase("session-quiz");
  };

  const completeSessionQuiz = () => {
    // Wrong answers -> Add to Bank. Correct -> Remove (if they were in bank).
    const correctWords = sessionQuizData.questions
      .filter(q => q.userAnswer === q.correctMeaning)
      .map(q => q.word);
    
    const wrongWords = sessionQuizData.questions
      .filter(q => q.userAnswer !== q.correctMeaning);
      
    let newBank = [...vocabBank];
    
    // Remove correct ones
    newBank = newBank.filter(w => !correctWords.includes(w.word));
    
    // Add wrong ones (if not already there)
    wrongWords.forEach(w => {
      if (!newBank.find(existing => existing.word === w.word)) {
        newBank.push({ word: w.word, reading: w.reading, meaning: w.meaning, added: todayStr() });
      }
    });

    persistVocab(newBank);
    finishDay();
  };

  const finishDay = () => {
    const td = todayStr();
    if (!days.includes(td)) {
      persistDays([...days, td]);
    }
    // Reset session state
    setSessionQuizData(null);
    setSessionUnknownWords([]);
    setPhase("home");
  };

  // === ARTICLE GENERATION ===
  const generateArticles = () => {
    setPhase("generating");
    // SIMULATION: In a real app, this calls Anthropic API with feedback history.
    // Here we use setTimeOut + Mock Data
    setTimeout(() => {
      const newDaily = {
        date: todayStr(),
        suggested: MOCK_GENERATED_ARTICLES, // Using the mocked JP news
        selected: []
      };
      persistArticles(newDaily);
      setPhase("pick");
    }, 2000);
  };

  const toggleArticleSelection = (article) => {
    const selected = dailyArticles.selected || [];
    const isSelected = selected.find(a => a.id === article.id);
    let newSelected;
    
    if (isSelected) {
      newSelected = selected.filter(a => a.id !== article.id);
    } else {
      if (selected.length >= 3) return; // Max 3
      newSelected = [...selected, article];
    }
    persistArticles({ ...dailyArticles, selected: newSelected });
  };

  const confirmSelection = () => {
    if (dailyArticles.selected.length > 0) {
      setCurrentArticleIndex(0);
      setPhase("vocab-preview");
    }
  };

  // === READING & LOOKUP ===
  const getCurrentArticle = () => dailyArticles.selected[currentArticleIndex];

  const handleLookup = async (term) => {
    const cleanTerm = term.trim();
    if (!cleanTerm) return;
    
    // Check if we know it locally first
    let found = vocabBank.find(v => v.word === cleanTerm) || 
                getCurrentArticle().vocabWords.find(v => v.word === cleanTerm) ||
                FALLBACK_VOCAB.find(v => v.word === cleanTerm);

    const result = found ? found : {
      word: cleanTerm,
      reading: "（検索結果）",
      meaning: "API検索シミュレーション中... (本来はAIが定義を生成)"
    };

    setLookupResult(result);
    setSidebarLookupTerm(""); // clear input
    
    // Track as unknown
    setSessionUnknownWords(prev => {
      if (prev.find(w => w.word === result.word)) return prev;
      return [...prev, { ...result, added: todayStr() }];
    });
  };

  const handleArticleFeedback = (isPositive) => {
    const art = getCurrentArticle();
    if (isPositive) {
      const entry = { articleId: art.id, positive: true, category: art.category, title: art.title, date: todayStr() };
      persistFeedback([...feedback, entry]);
      setFeedbackMode(null); // Close if open
    } else {
      setFeedbackMode(art.id); // Open comment box
    }
  };

  const submitNegativeFeedback = () => {
    const art = getCurrentArticle();
    const entry = { articleId: art.id, positive: false, comment: feedbackInput, category: art.category, title: art.title, date: todayStr() };
    persistFeedback([...feedback, entry]);
    setFeedbackInput("");
    setFeedbackMode(null);
  };

  // === RENDERERS ===

  // 1. REVIEW QUIZ
  if (phase === "review-quiz" && reviewQuizData) {
    if (reviewQuizData.index >= reviewQuizData.questions.length) {
      return (
        <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
            <Brain size={48} className="mx-auto text-blue-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">復習完了</h2>
            <p className="text-gray-400 mb-6">スコア: {reviewQuizData.score} / {reviewQuizData.questions.length}</p>
            <button onClick={completeReviewQuiz} className="w-full py-3 bg-blue-600 rounded-lg font-bold">次へ進む</button>
          </div>
        </div>
      );
    }
    const q = reviewQuizData.questions[reviewQuizData.index];
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="mb-4 flex justify-between text-sm text-gray-400">
            <span>復習クイズ</span>
            <span>{reviewQuizData.index + 1} / {reviewQuizData.questions.length}</span>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 mb-4 text-center">
            <h1 className="text-3xl font-bold mb-2">{q.word}</h1>
            <p className="text-blue-400">【{q.reading}】</p>
          </div>
          <div className="space-y-3">
            {q.choices.map((c, i) => (
              <button key={i} onClick={() => handleQuizAnswer(c, true)} className="w-full text-left p-4 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors">
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 2. GENERATING
  if (phase === "generating") {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
        <h2 className="text-xl font-bold">記事を生成中...</h2>
        <p className="text-gray-500 text-sm mt-2">最新のニュースから記事を作成しています</p>
      </div>
    );
  }

  // 3. PICK ARTICLES
  if (phase === "pick") {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 p-4 font-sans">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-bold mb-1">今日の記事を選択</h1>
          <p className="text-sm text-gray-500 mb-6">興味のある記事を3つまで選んでください</p>
          
          <div className="space-y-4 mb-8">
            {dailyArticles.suggested.map(art => {
              const isSelected = dailyArticles.selected.find(a => a.id === art.id);
              return (
                <div 
                  key={art.id} 
                  onClick={() => toggleArticleSelection(art)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-blue-950/30 border-blue-500 ring-1 ring-blue-500' : 'bg-gray-900 border-gray-800 hover:border-gray-700'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded text-white ${art.catColor}`}>{art.category}</span>
                    {isSelected && <CheckCircle size={20} className="text-blue-500" />}
                  </div>
                  <h3 className="font-bold text-lg mb-2 leading-snug">{art.title}</h3>
                  <p className="text-gray-400 text-sm">{art.summary}</p>
                  <div className="mt-3 text-xs text-gray-600 font-mono">語彙数: {art.vocabWords.length}</div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-4">
            <button onClick={generateArticles} className="flex-1 py-3 bg-gray-800 text-gray-400 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
              <RefreshCw size={16}/> 再生成
            </button>
            <button 
              onClick={confirmSelection} 
              disabled={dailyArticles.selected.length === 0}
              className="flex-[2] py-3 bg-blue-600 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg font-bold"
            >
              読書を開始 ({dailyArticles.selected.length}本)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. VOCAB PREVIEW
  if (phase === "vocab-preview") {
    const art = getCurrentArticle();
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 p-6 flex flex-col items-center justify-center">
        <div className="max-w-lg w-full">
          <div className="text-center mb-6">
            <span className={`text-xs font-bold px-2 py-0.5 rounded text-white mb-2 inline-block ${art.catColor}`}>{art.category}</span>
            <h2 className="text-xl font-bold">{art.title}</h2>
            <p className="text-gray-500 text-sm mt-1">重要語彙プレビュー</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-8">
            {art.vocabWords.map((v, i) => (
              <div key={i} className="flex justify-between items-center p-4 border-b border-gray-800 last:border-0">
                <div>
                  <div className="font-bold text-blue-300">{v.word}</div>
                  <div className="text-xs text-gray-500">{v.reading}</div>
                </div>
                <div className="text-sm text-gray-400">{v.meaning}</div>
              </div>
            ))}
          </div>

          <button onClick={() => setPhase("read")} className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2">
            本文へ進む <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  // 5. READING SCREEN (Core)
  if (phase === "read") {
    const art = getCurrentArticle();
    
    // Content Parser for Furigana {name|reading} AND Vocab Highlighting
    const renderContent = (text) => {
      // 1. Split by furigana segments
      const parts = text.split(/(\{.*?\|.*?\})/g);
      
      return parts.map((part, i) => {
        // Handle Furigana: {Name|Reading}
        const match = part.match(/^\{(.*?)\|(.*?)\}$/);
        if (match) {
          return (
            <ruby key={i} className="mx-0.5">
              {match[1]}<rt className="text-gray-500 select-none text-[0.6em]">{match[2]}</rt>
            </ruby>
          );
        }
        
        // Handle Plain Text: Scan for Vocab Words
        const vocabToFind = art.vocabWords;
        let subParts = [part];
        
        // Iterate through all vocab words and split the text further
        vocabToFind.forEach(vocab => {
          const newSubParts = [];
          subParts.forEach(subPart => {
            if (typeof subPart !== 'string') {
              newSubParts.push(subPart); // Already processed (React Node)
              return;
            }
            
            // Split by current vocab word
            const splitByVocab = subPart.split(vocab.word);
            splitByVocab.forEach((segment, idx) => {
              if (idx > 0) {
                // Insert the vocab word as a clickable element
                const isUnknown = sessionUnknownWords.some(w => w.word === vocab.word);
                newSubParts.push(
                  <span 
                    key={`${i}-${vocab.word}-${idx}`}
                    onClick={(e) => { e.stopPropagation(); handleLookup(vocab.word); }}
                    className={`border-b-2 border-dotted cursor-pointer mx-0.5 ${
                      isUnknown 
                        ? "border-red-400 text-red-300 bg-red-900/30" 
                        : "border-blue-500 text-blue-300 hover:bg-blue-900/30"
                    }`}
                  >
                    {vocab.word}
                  </span>
                );
              }
              if (segment) newSubParts.push(segment);
            });
          });
          subParts = newSubParts;
        });

        return <span key={i}>{subParts}</span>;
      });
    };

    const nextArticle = () => {
      if (currentArticleIndex < dailyArticles.selected.length - 1) {
        setCurrentArticleIndex(prev => prev + 1);
        setPhase("vocab-preview");
      } else {
        setupSessionQuiz();
      }
    };

    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex">
        {/* LEFT: Content (2/3) */}
        <div className="w-2/3 p-8 overflow-y-auto h-screen border-r border-gray-900">
          <div className="max-w-3xl mx-auto">
            <span className={`text-xs font-bold px-2 py-0.5 rounded text-white mb-4 inline-block ${art.catColor}`}>{art.category}</span>
            <h1 className="text-3xl font-bold mb-8 leading-normal text-white">{art.title}</h1>
            
            <div 
              className="text-lg leading-loose font-serif text-gray-200" 
              style={{ fontFamily: "'Noto Serif JP', serif" }}
              onMouseUp={() => {
                const s = window.getSelection().toString().trim();
                if (s.length > 0 && s.length < 10) handleLookup(s);
              }}
            >
              {renderContent(art.content)}
            </div>

            {/* Feedback Section */}
            <div className="mt-12 pt-8 border-t border-gray-900">
              <div className="flex items-center gap-4 mb-4">
                <span className="text-sm text-gray-500">この記事の評価:</span>
                <button onClick={() => handleArticleFeedback(true)} className="p-2 bg-gray-900 hover:bg-green-900/30 rounded-full text-gray-400 hover:text-green-500 transition-colors"><ThumbsUp size={20}/></button>
                <button onClick={() => handleArticleFeedback(false)} className="p-2 bg-gray-900 hover:bg-red-900/30 rounded-full text-gray-400 hover:text-red-500 transition-colors"><ThumbsDown size={20}/></button>
              </div>
              
              {feedbackMode === art.id && (
                <div className="bg-gray-900 p-4 rounded-lg">
                  <textarea 
                    value={feedbackInput}
                    onChange={(e) => setFeedbackInput(e.target.value)}
                    placeholder="改善点や気に入らなかった理由を入力..." 
                    className="w-full bg-gray-950 border border-gray-800 rounded p-2 text-sm text-white mb-2 focus:outline-none focus:border-red-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setFeedbackMode(null)} className="text-sm text-gray-500 px-3 py-1">キャンセル</button>
                    <button onClick={submitNegativeFeedback} className="text-sm bg-red-600 text-white px-3 py-1 rounded">送信</button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="h-24"></div> {/* Spacer */}
          </div>
          
          {/* Bottom Nav (Sticky within Left Col) */}
          <div className="fixed bottom-0 left-0 w-2/3 bg-gray-950/90 backdrop-blur border-t border-gray-900 p-4 flex justify-between items-center px-12">
            <button onClick={() => setupSessionQuiz()} className="text-orange-500 font-bold text-sm hover:underline">
              セッション終了・クイズへ
            </button>
            <button onClick={nextArticle} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg flex items-center gap-2">
              {currentArticleIndex < dailyArticles.selected.length - 1 ? "次の記事へ" : "完了してクイズへ"} <ChevronRight size={18}/>
            </button>
          </div>
        </div>

        {/* RIGHT: Sidebar (1/3) */}
        <div className="w-1/3 bg-gray-900 h-screen p-6 overflow-y-auto flex flex-col">
          {/* Lookup Box */}
          <div className="mb-6">
            <div className="relative">
              <input 
                type="text" 
                value={sidebarLookupTerm}
                onChange={(e) => setSidebarLookupTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup(sidebarLookupTerm)}
                placeholder="辞書検索..." 
                className="w-full bg-gray-950 border border-gray-800 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-blue-500 text-white"
              />
              <Search className="absolute left-3 top-3.5 text-gray-500" size={18} />
            </div>
          </div>

          {/* Result Card */}
          {lookupResult && (
            <div className="bg-blue-950/40 border border-blue-900/50 rounded-xl p-4 mb-6 animate-in slide-in-from-right-2">
              <div className="flex justify-between items-start">
                <h3 className="text-2xl font-bold text-white mb-1">{lookupResult.word}</h3>
                <button onClick={() => setLookupResult(null)}><X size={16} className="text-blue-400"/></button>
              </div>
              <p className="text-blue-300 text-sm mb-3">【{lookupResult.reading}】</p>
              <p className="text-gray-200 leading-relaxed">{lookupResult.meaning}</p>
            </div>
          )}

          {/* Unknown Words List */}
          <div className="mb-6 flex-1">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">セッション不明語 ({sessionUnknownWords.length})</h3>
            <div className="space-y-2">
              {sessionUnknownWords.map((w, i) => (
                <div key={i} className="bg-gray-950 border border-gray-800 rounded p-3 flex justify-between items-center cursor-pointer hover:border-gray-600" onClick={() => setLookupResult(w)}>
                  <span className="font-bold text-red-400">{w.word}</span>
                  <span className="text-xs text-gray-500">{w.reading}</span>
                </div>
              ))}
              {sessionUnknownWords.length === 0 && (
                <p className="text-sm text-gray-600 italic">記事中の単語を選択すると、ここに追加されます</p>
              )}
            </div>
          </div>

          {/* Article Vocab List */}
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">記事の重要語彙</h3>
            <div className="space-y-1">
              {art.vocabWords.map((w, i) => (
                <div key={i} className="flex gap-2 text-sm p-2 rounded hover:bg-gray-800 cursor-pointer" onClick={() => handleLookup(w.word)}>
                  <span className="text-blue-400 font-bold">{w.word}</span>
                  <span className="text-gray-500 truncate">{w.meaning}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 6. SESSION QUIZ
  if (phase === "session-quiz" && sessionQuizData) {
    if (sessionQuizData.index >= sessionQuizData.questions.length) {
      return (
        <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
            <Trophy size={48} className="mx-auto text-yellow-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">セッション完了！</h2>
            <p className="text-gray-400 mb-6">スコア: {sessionQuizData.score} / {sessionQuizData.questions.length}</p>
            <p className="text-sm text-gray-500 mb-6">間違えた単語は学習バンクに保存されました。</p>
            <button onClick={completeSessionQuiz} className="w-full py-3 bg-blue-600 rounded-lg font-bold">ホームへ戻る</button>
          </div>
        </div>
      );
    }
    const q = sessionQuizData.questions[sessionQuizData.index];
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
           <div className="mb-4 flex justify-between text-sm text-gray-400">
            <span>学習クイズ</span>
            <span>{sessionQuizData.index + 1} / {sessionQuizData.questions.length}</span>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 mb-4 text-center">
            <h1 className="text-3xl font-bold mb-2 text-red-400">{q.word}</h1>
            <p className="text-gray-400">【{q.reading}】</p>
          </div>
          <div className="space-y-3">
            {q.choices.map((c, i) => (
              <button key={i} onClick={() => handleQuizAnswer(c, false)} className="w-full text-left p-4 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors">
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 7. HOME DASHBOARD
  if (phase === "home") {
    const hasReadToday = days.includes(todayStr());
    
    // Calendar logic
    const today = new Date();
    const currentMonth = today.getMonth();
    const daysInMonth = new Date(today.getFullYear(), currentMonth + 1, 0).getDate();
    
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-end mb-8 border-b border-gray-800 pb-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BookOpen className="text-red-500"/> 日本語読解トレーナー
              </h1>
              <p className="text-gray-500 text-sm mt-1">N2+ Advanced Reader</p>
            </div>
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <div className="text-gray-500 text-xs">連続記録</div>
                <div className="font-bold text-xl flex justify-center items-center gap-1 text-yellow-500">
                  <Zap size={16} fill="currentColor" /> {days.length > 0 ? "3" : "0"}日
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 text-xs">総読破数</div>
                <div className="font-bold text-xl">{days.length}日</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Left: Main Action */}
            <div className="md:col-span-2 space-y-6">
              {!hasReadToday ? (
                <div className="bg-gradient-to-br from-blue-900/20 to-gray-900 border border-blue-900/50 rounded-2xl p-8 text-center">
                  <h2 className="text-2xl font-bold mb-2">今日のセッション</h2>
                  <p className="text-gray-400 mb-8">AIが最新ニュースからあなた専用の記事を作成します。</p>
                  <button onClick={generateArticles} className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2 w-full md:w-auto mx-auto">
                    <Zap size={20} fill="currentColor" /> 記事を生成する
                  </button>
                </div>
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
                  <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold mb-2">本日の学習完了</h2>
                  <p className="text-gray-400 mb-6">お疲れ様でした。明日も継続しましょう。</p>
                  <button onClick={() => setPhase("review-quiz")} className="text-sm text-gray-500 underline">
                    復習クイズをテスト実行
                  </button>
                </div>
              )}

              {/* Stats / Feedback Preview */}
              <div className="grid grid-cols-2 gap-4">
                 <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">学習中単語</h3>
                    <div className="text-2xl font-bold">{vocabBank.length}語</div>
                 </div>
                 <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">フィードバック数</h3>
                    <div className="text-2xl font-bold">{feedback.length}件</div>
                 </div>
              </div>
            </div>

            {/* Right: Calendar & Info */}
            <div className="space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                  <Calendar size={14}/> {today.getMonth() + 1}月の学習
                </h3>
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {["日","月","火","水","木","金","土"].map(d => <div key={d} className="text-gray-600 mb-1">{d}</div>)}
                  {Array.from({length: daysInMonth}).map((_, i) => {
                     // Check if this specific day is in the persistent store
                     const checkDate = new Date(today.getFullYear(), currentMonth, i + 1).toISOString().slice(0, 10);
                     const isRead = days.includes(checkDate);
                     return (
                       <div key={i} className={`aspect-square flex items-center justify-center rounded ${isRead ? 'bg-red-600 text-white font-bold' : 'bg-gray-800/50 text-gray-600'}`}>
                         {i+1}
                       </div>
                     );
                  })}
                </div>
              </div>
              
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">復習予定の単語</h3>
                {vocabBank.length === 0 ? (
                  <p className="text-sm text-gray-600">まだありません</p>
                ) : (
                  <div className="space-y-2">
                    {vocabBank.slice(0, 5).map((w, i) => (
                      <div key={i} className="flex justify-between text-sm border-b border-gray-800 pb-2 last:border-0">
                        <span className="text-red-400 font-bold">{w.word}</span>
                        <span className="text-gray-600 text-xs">{w.reading}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <div className="min-h-screen bg-gray-950 text-gray-400 flex items-center justify-center">Loading...</div>;
}