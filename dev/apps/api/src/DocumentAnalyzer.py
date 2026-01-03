import re
import numpy as np
from collections import Counter
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import networkx as nx

class DocumentAnalyzer:
    """ 
    주요 키워드, 주요 문장, 문단 별 키워드, 문단 별 주요 문장을 추출하는 코드
    입력: RSS content
    """
    # ============================
    #  불용어 리스트
    # ============================
    STOPWORDS = {
        'this', 'that', 'they', 'them', 'the', 'and', 'are', 'will',
        'been', 'have', 'with', 'from', 'would', 'could', 'should',
        'about', 'which', 'there', 'their', 'what', 'when', 'where',
        'being', 'such', 'more', 'also', 'some', 'other', 'like',
        'these', 'doing', 'trying', 'going', 'making', 'getting',
        'taking', 'coming', 'looking', 'using', 'finding', 'giving',
        'telling', 'working', 'calling', 'keeping', 'becoming',
        'seeming', 'feeling', 'beginning', 'helping', 'moving',
        'bringing', 'happening', 'saying', 'thinking', 'seeing',
        'knowing', 'wanting', 'leaving', 'showing', 'hearing',
        'playing', 'running', 'turning', 'starting', 'asking',
        'talking', 'putting', 'allowing', 'following', 'does', 'done',
        'make', 'makes', 'made', 'take', 'takes', 'took', 'come',
        'comes', 'came', 'goes', 'went', 'said', 'says', 'mean',
        'means', 'meant', 'seem', 'seems', 'seemed', 'feel', 'feels',
        'felt', 'look', 'looks', 'looked', 'need', 'needs', 'needed',
        'since', 'until', 'while', 'during', 'after', 'before',
        'when', 'where', 'here', 'there', 'then', 'now', 'today',
        'year', 'years', 'time', 'times', 'once', 'always', 'never',
        'often', 'sometimes', 'thing', 'things', 'way', 'ways',
        'people', 'person', 'part', 'parts', 'place', 'places',
        'case', 'cases', 'point', 'points', 'fact', 'facts', 'work',
        'works', 'life', 'lives', 'hand', 'hands', 'area', 'areas',
        'world', 'number', 'group', 'system', 'change', 'changes',
        'heart', 'mind', 'body', 'face', 'eyes', 'head', 'very',
        'just', 'even', 'still', 'back', 'most', 'many', 'much',
        'well', 'only', 'then', 'than', 'into', 'over', 'through',
        'between', 'under', 'again', 'further', 'already', 'yet',
        'because', 'however', 'therefore', 'thus', 'though',
        'although', 'unless', 'whether', 'either', 'neither', 'both',
        'each', 'every', 'sure', 'must', 'might', 'maybe', 'perhaps',
        'quite', 'rather', 'enough', 'little', 'less', 'least',
        'several', 'few', 'fewer', 'another', 'same', 'different',
        'whole', 'half'
    }

    # ============================
    #  생성자
    # ============================
    def __init__(self, html_content):
        if html_content is None:
            self.html = ""
        elif isinstance(html_content, list):
            # feedparser entry.content 대응
            self.html = html_content[0].get("value", "")
        elif isinstance(html_content, dict):
            self.html = html_content.get("value", "")
        else:
            self.html = str(html_content)

    # ============================
    #  유틸 함수들
    # ============================
    def split_into_paragraphs(self, text):
        text = re.sub(r'<!\[CDATA\[|\]\]>', '', text)
        paragraphs = re.findall(r'<p>(.*?)</p>', text, re.DOTALL)

        clean = []
        for para in paragraphs:
            para = re.sub(r'<[^>]+>', '', para)
            para = para.replace('&#8217;', "'").replace('&#8220;', '"')
            para = para.replace('&#8221;', '"').replace('&quot;', '"')
            para = para.replace('&amp;', '&')
            para = re.sub(r'\s+', ' ', para).strip()
            if len(para) > 30:
                clean.append(para)
        return clean

    def split_sentences(self, text):
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if len(s.strip()) > 20]

    def normalize_plural(self, word):
        if word.endswith('ies'): return word[:-3] + 'y'
        if word.endswith('es'): return word[:-2]
        if word.endswith('s') and not word.endswith('ss'): return word[:-1]
        return word

    def normalize_bigram(self, bigram):
        return ' '.join(self.normalize_plural(w) for w in bigram.split())

    # ============================
    #  키워드 중복 처리
    # ============================
    def deduplicate_keywords(self, singles, bigrams):
        normalized_singles = {}
        for w, s in singles:
            nw = self.normalize_plural(w)
            if nw not in normalized_singles or normalized_singles[nw] < s:
                normalized_singles[nw] = s

        normalized_bigrams = {}
        for bg, s in bigrams:
            nbg = self.normalize_bigram(bg)
            if nbg not in normalized_bigrams or normalized_bigrams[nbg] < s:
                normalized_bigrams[nbg] = s

        final_bigrams = list(normalized_bigrams.items())

        bigram_words = {w for bg, _ in final_bigrams for w in bg.split()}

        filtered_singles = [
            (w, s) for w, s in normalized_singles.items() if w not in bigram_words
        ]

        merged = final_bigrams + filtered_singles
        merged.sort(key=lambda x: x[1], reverse=True)
        return merged

    # ============================
    #  키워드 추출(TextRank + Bigram)
    # ============================
    def extract_keywords(self, text, top_n=10):
        words = re.findall(r'\b[a-zA-Z]+\b', text.lower())
        words = [w for w in words if w not in self.STOPWORDS and len(w) > 3]

        if len(words) < 2:
            return []

        graph = nx.Graph()
        window_size = 5

        for i in range(len(words)):
            for j in range(i + 1, min(i + window_size, len(words))):
                if words[i] != words[j]:
                    if graph.has_edge(words[i], words[j]):
                        graph[words[i]][words[j]]['weight'] += 1
                    else:
                        graph.add_edge(words[i], words[j], weight=1)

        if len(graph.nodes()) == 0:
            return []

        try:
            scores = nx.pagerank(graph, weight='weight')
            ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
            single_keywords = ranked[:10]

            bigrams = [f"{words[i]} {words[i+1]}" for i in range(len(words)-1)]
            bigram_freq = Counter(bigrams)

            bigram_scores = []
            for bg, freq in bigram_freq.items():
                if freq >= 2:
                    w1, w2 = bg.split()
                    sc = freq * (scores.get(w1, 0) + scores.get(w2, 0)) / 2
                    bigram_scores.append((bg, sc))

            bigram_scores.sort(key=lambda x: x[1], reverse=True)
            top_bigrams = bigram_scores[:5]

            return self.deduplicate_keywords(single_keywords, top_bigrams)[:top_n]

        except:
            freq = Counter(words)
            return freq.most_common(top_n)

    # ============================
    #  문장 TextRank
    # ============================
    def extract_sentences_textrank(self, sentences, top_n=3):
        if len(sentences) <= top_n:
            return sentences

        try:
            tfidf = TfidfVectorizer().fit_transform(sentences)
            sim = cosine_similarity(tfidf)
            graph = nx.from_numpy_array(sim)
            scores = nx.pagerank(graph)

            ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
            top_indices = sorted(idx for idx, _ in ranked[:top_n])
            return [sentences[i] for i in top_indices]
        except:
            return sentences[:top_n]

    # ============================
    #  메인 분석 함수
    # ============================
    def analyze(self, top_sentences_count=3):
        paragraphs = self.split_into_paragraphs(self.html)
        full_text = " ".join(paragraphs)

        global_keywords = self.extract_keywords(full_text, top_n=12)

        paragraph_sents = []
        paragraph_keywords = []

        for para in paragraphs:
            kws = self.extract_keywords(para, top_n=6)
            paragraph_keywords.append(kws)

            sentences = self.split_sentences(para)
            if not sentences:
                sent = para[:150] + "..." if len(para) > 150 else para
            elif len(sentences) == 1:
                sent = sentences[0]
            else:
                sent = self.extract_sentences_textrank(sentences, top_n=1)[0]

            paragraph_sents.append(sent)

        all_sentences = []
        for para in paragraphs:
            all_sentences.extend(self.split_sentences(para))

        global_top_sents = (
            self.extract_sentences_textrank(all_sentences, top_n=top_sentences_count)
            if all_sentences else []
        )

        return {
            'paragraph_sentences': paragraph_sents,
            'paragraph_keywords_scores': paragraph_keywords,
            'global_top_sentences': global_top_sents,
            'global_keywords_scores': global_keywords
        }
