let currentQAPairs = [];

function nextQuestion() {
    const text = document.getElementById('customInput').value;
    generateAndRenderQuestion(text);
}

function generateAndRenderQuestion(text) {
    if (!text) return;

    // 1. 解析文本，寻找合法的测试对
    // 规则：被逗号、分号等连接的两个中文片段，不能跨越句号、感叹号、引号等。
    const pairs = findValidPairs(text);

    const cardContent = document.getElementById('qaCardContent');

    if (pairs.length === 0) {
        cardContent.innerHTML = "当前文本太短或没有标点，无法生成上下句测试。";
        return;
    }

    // 2. 随机选取一对
    const pair = pairs[Math.floor(Math.random() * pairs.length)];
    
    // 3. 随机决定方向 (0: 给出前句测后句, 1: 给出后句测前句)
    const direction = Math.random() > 0.5 ? 0 : 1;

    let html = '';
    
    // 生成HTML辅助函数：根据是否遮盖生成 span
    const generateSpan = (str, isMasked) => {
        if (!isMasked) return `<span class="char">${str}</span>`;
        
        // 对每个字进行遮盖
        let s = '';
        for(let c of str) {
            s += `<span class="char masked" data-answer="${c}">${c}</span>`;
        }
        return s;
    };

    const safePunc = `<span class="punctuation">${pair.punc}</span>`;

    if (direction === 0) {
        // 给上句，测下句
        html += generateSpan(pair.prev, false);
        html += safePunc;
        html += generateSpan(pair.next, true);
    } else {
        // 给下句，测上句
        html += generateSpan(pair.prev, true);
        html += safePunc;
        html += generateSpan(pair.next, false);
    }

    cardContent.innerHTML = html;
}

// 复杂的文本解析算法：寻找合法句对
function findValidPairs(text) {
    // 定义“停止符”：遇到这些符号，说明句子彻底结束，不能跨越测试
    // 包含：句号、问号、感叹号、冒号、换行、引号(防止引号内外的逻辑混淆)
    const stopRegex = /[。？！：:?!\n\r"“”'‘’]/;
    
    // 定义“连接符”：可以作为上下句连接的符号
    // 包含：逗号、分号、顿号
    const connectRegex = /[，,；;、]/;

    // 1. 先按停止符切断成大块（Sentence Block）
    // 使用 split 正则保留分隔符，以便我们知道边界，虽然这里我们其实只需要内容
    const blocks = text.split(stopRegex);
    
    const validPairs = [];

    blocks.forEach(block => {
        if (!block.trim()) return;

        // 2. 在大块内部，按连接符寻找中文片段
        // 正则逻辑：(中文片段)(连接符)(中文片段)...
        // 使用 matchAll 或简单的 split
        // 这里我们手动遍历以确保精确控制
        
        // 简单的分词：分割出 [中文, 标点, 中文, 标点...]
        // 注意：block可能包含 "中文,中文;中文"
        const segments = [];
        let buffer = '';
        let lastType = 'none'; // 'text' or 'punc'

        for (let char of block) {
            if (connectRegex.test(char)) {
                // 是连接标点
                if (buffer && lastType === 'text') {
                    segments.push({ type: 'text', val: buffer });
                    buffer = '';
                }
                // 如果标点连续，合并处理或者单独存？这里简化，标点单独存
                segments.push({ type: 'punc', val: char });
                lastType = 'punc';
            } else if (/[\u4e00-\u9fa5]/.test(char)) {
                // 是中文
                if (lastType === 'punc') {
                    buffer = ''; // 新的文字段开始
                }
                buffer += char;
                lastType = 'text';
            } else {
                // 其他字符（如空格、无关符号），忽略或视为断点？
                // 简单起见，如果buffer里有中文，视为一段结束
                // 但不存入标点，这样会断开连接
            }
        }
        if (buffer && lastType === 'text') {
            segments.push({ type: 'text', val: buffer });
        }

        // 3. 组装 Pairs
        // segments 结构如: [{text:'蜀道之难'}, {punc:'，'}, {text:'难于上青天'}]
        for (let i = 0; i < segments.length - 2; i++) {
            const prev = segments[i];
            const punc = segments[i+1];
            const next = segments[i+2];

            if (prev.type === 'text' && punc.type === 'punc' && next.type === 'text') {
                // 找到一对！
                validPairs.push({
                    prev: prev.val,
                    punc: punc.val,
                    next: next.val
                });
            }
        }
    });

    return validPairs;
}

function showQaAnswer() {
    // 找到 QA 卡片里所有被遮盖的字，移除 'masked' 类名即可
    const maskedChars = document.querySelectorAll('#qaCardContent .masked');
    maskedChars.forEach(char => {
        char.classList.remove('masked');
        // 可选：加个颜色表示这是翻开的答案
        char.style.color = '#10b981'; 
    });
}