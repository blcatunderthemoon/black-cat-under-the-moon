import { useCallback, useEffect, useRef, useState } from 'react';
import LoadingText from './LoadingText.js';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { Markdown } from 'tiptap-markdown';
import {
  buildForumImageMarkdown,
  isCloudinaryForumUploadConfigured,
  uploadForumImage,
} from '../lib/cloudinary-forum-upload.js';
import {
  createPollId,
  POLL_LIMITS,
} from '../lib/forum-poll.js';
import {
  getActiveMentionQuery,
} from '../lib/forum-mentions.js';
import { extractYoutubeVideoId } from '../lib/forum-youtube.js';
import { ForumPollNode } from '../lib/forum-tiptap-poll-extension.js';
import { ForumYoutubeNode } from '../lib/forum-tiptap-youtube-extension.js';
import {
  getForumEditorMarkdown,
  setForumEditorMarkdown,
  hasStoryHorizontalRules,
} from '../lib/forum-tiptap-markdown.js';
import { preserveMarkdownLeadingSpaces } from '../lib/forum-story.js';
import ForumEditorOverlay from './ForumEditorOverlay.js';

const MENTION_DEBOUNCE_MS = 220;

function applyMarkdownToEditor(ed, markdown) {
  const next = String(markdown || '');
  if (!next) return;
  const hasEmbeds = /::poll\[|::youtube\[/i.test(next);
  const hasRules = hasStoryHorizontalRules(next);
  if (hasEmbeds || hasRules) {
    setForumEditorMarkdown(ed, next);
  } else {
    ed.commands.setContent(
      preserveMarkdownLeadingSpaces(next),
      false,
      { contentType: 'markdown' },
    );
  }
}

export default function ForumTiptapEditor({
  value,
  onChange,
  contentRef,
  polls = [],
  onPollsChange,
  accessToken,
  maxLength = 2000,
  placeholder = '說說你想說的…',
  disabled = false,
  storyMode = false,
  flushRef,
}) {
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionItems, setMentionItems] = useState([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [pollDialogOpen, setPollDialogOpen] = useState(false);
  const [pollTitle, setPollTitle] = useState('投票');
  const [pollOptionsText, setPollOptionsText] = useState('選項一\n選項二\n選項三');
  const [pollError, setPollError] = useState('');
  const [youtubeDialogOpen, setYoutubeDialogOpen] = useState(false);
  const [youtubeInput, setYoutubeInput] = useState('');
  const [youtubeError, setYoutubeError] = useState('');
  const fileInputRef = useRef(null);
  const youtubeInputRef = useRef(null);
  const mentionTimerRef = useRef(null);
  const skipExternalSyncRef = useRef(false);
  const hydratingRef = useRef(false);
  const mentionKeyDownRef = useRef(() => false);
  const pollsRef = useRef(polls);
  const onPollsChangeRef = useRef(onPollsChange);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  const editorRef = useRef(null);
  const storyModeRef = useRef(storyMode);
  const syncEditorMarkdownRef = useRef(() => {});
  const imageUploadEnabled = isCloudinaryForumUploadConfigured();

  storyModeRef.current = storyMode;

  valueRef.current = value;
  pollsRef.current = polls;
  onChangeRef.current = onChange;
  onPollsChangeRef.current = onPollsChange;

  const closeMention = useCallback(() => {
    setMentionOpen(false);
    setMentionItems([]);
    setMentionIndex(0);
  }, []);

  const searchMentions = useCallback(async (query) => {
    if (!accessToken || !query) {
      setMentionItems([]);
      return;
    }
    setMentionLoading(true);
    try {
      const r = await fetch('/api/forum/users/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ q: query }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setMentionItems([]);
        return;
      }
      setMentionItems(data.users || []);
      setMentionIndex(0);
    } catch {
      setMentionItems([]);
    } finally {
      setMentionLoading(false);
    }
  }, [accessToken]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder }),
      CharacterCount.configure({ limit: maxLength }),
      Markdown.configure({
        html: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      ForumPollNode.configure({
        getPollMeta: (pollId) => pollsRef.current.find((p) => p.id === pollId),
        onRemovePoll: (pollId) => {
          onPollsChangeRef.current?.(
            pollsRef.current.filter((p) => p.id !== pollId),
          );
        },
      }),
      ForumYoutubeNode,
    ],
    content: '',
    editable: !disabled,
    immediatelyRender: false,
    onCreate: ({ editor: ed }) => {
      const initial = valueRef.current;
      if (!initial) return;
      hydratingRef.current = true;
      try {
        applyMarkdownToEditor(ed, initial);
        skipExternalSyncRef.current = true;
      } finally {
        queueMicrotask(() => {
          hydratingRef.current = false;
        });
      }
    },
    editorProps: {
      handleKeyDown(_view, event) {
        if (mentionKeyDownRef.current(event)) return true;

        const ed = editorRef.current;
        if (!ed || ed.isDestroyed || !storyModeRef.current) return false;

        if (event.key === 'Enter') {
          event.preventDefault();
          const inserted = event.shiftKey
            ? ed.chain().focus().setHardBreak().run()
            : ed.chain().focus().splitBlock().run();
          if (inserted) syncEditorMarkdownRef.current(ed);
          return true;
        }

        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (hydratingRef.current) return;
      const md = getForumEditorMarkdown(ed);
      if (contentRef) contentRef.current = md;
      skipExternalSyncRef.current = true;
      onChangeRef.current(md);

      if (!accessToken) {
        closeMention();
        return;
      }
      const { from } = ed.state.selection;
      const textBefore = ed.state.doc.textBetween(0, from, '\n');
      const active = getActiveMentionQuery(textBefore, textBefore.length);
      if (!active) {
        closeMention();
        return;
      }
      setMentionOpen(true);
      if (mentionTimerRef.current) clearTimeout(mentionTimerRef.current);
      mentionTimerRef.current = setTimeout(() => {
        searchMentions(active.query);
      }, MENTION_DEBOUNCE_MS);
    },
  }, [disabled, placeholder, maxLength, accessToken, closeMention, searchMentions]);

  editorRef.current = editor;

  useEffect(() => {
    if (!editor || editor.isDestroyed || !editor.view) return;
    try {
      editor.view.dispatch(editor.state.tr);
    } catch {
      /* view not mounted yet */
    }
  }, [polls, editor]);

  useEffect(() => () => {
    if (mentionTimerRef.current) clearTimeout(mentionTimerRef.current);
  }, []);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return undefined;
    const prose = editor.view?.dom;
    if (!prose) return undefined;
    const scrollParent = prose.closest('.forum-tiptap__editor-wrap');
    if (!scrollParent) return undefined;

    const onWheel = (event) => {
      const { scrollTop, scrollHeight, clientHeight } = scrollParent;
      if (scrollHeight <= clientHeight + 1) return;

      const delta = event.deltaY;
      const atTop = scrollTop <= 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
      if ((delta < 0 && atTop) || (delta > 0 && atBottom)) return;

      scrollParent.scrollTop += delta;
      event.preventDefault();
    };

    prose.addEventListener('wheel', onWheel, { passive: false });
    return () => prose.removeEventListener('wheel', onWheel);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled && !uploading);
  }, [editor, disabled, uploading]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const current = getForumEditorMarkdown(editor);
    const next = value || '';

    if (!next.trim()) {
      skipExternalSyncRef.current = false;
      return;
    }

    if (current === next) {
      skipExternalSyncRef.current = false;
      return;
    }

    if (skipExternalSyncRef.current) {
      skipExternalSyncRef.current = false;
      if (current.trim() || !next.trim()) return;
    }

    try {
      hydratingRef.current = true;
      applyMarkdownToEditor(editor, next);
      skipExternalSyncRef.current = true;
    } catch {
      /* editor view not mounted yet */
    } finally {
      queueMicrotask(() => {
        hydratingRef.current = false;
      });
    }
  }, [editor, value]);

  function applyMention(user) {
    if (!editor) return;
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(0, from, '\n');
    const active = getActiveMentionQuery(textBefore, textBefore.length);
    if (!active) return;

    const name = String(user.display_name || '貓咪').slice(0, 20);
    const token = `@[${name}](${user.id}) `;
    const deleteFrom = from - (textBefore.length - active.start);

    editor.chain().focus()
      .deleteRange({ from: deleteFrom, to: from })
      .insertContent(token)
      .run();
    closeMention();
  }

  function handleMentionKeyDown(e) {
    if (!mentionOpen || !mentionItems.length) return false;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMentionIndex((i) => (i + 1) % mentionItems.length);
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMentionIndex((i) => (i - 1 + mentionItems.length) % mentionItems.length);
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      applyMention(mentionItems[mentionIndex]);
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeMention();
      return true;
    }
    return false;
  }

  useEffect(() => {
    mentionKeyDownRef.current = handleMentionKeyDown;
  });

  function insertPollBlock(pollId) {
    if (!editor) return;
    const inserted = editor.chain()
      .focus()
      .insertContent([
        { type: 'forumPoll', attrs: { pollId } },
        { type: 'paragraph' },
      ])
      .focus('end')
      .run();

    if (inserted) {
      skipExternalSyncRef.current = true;
      onChangeRef.current(getForumEditorMarkdown(editor));
    }

    requestAnimationFrame(() => {
      if (!editor.isDestroyed) editor.commands.focus('end');
    });
  }

  function insertYoutubeBlock(videoId) {
    if (!editor) return;
    const inserted = editor.chain()
      .focus()
      .insertContent([
        { type: 'forumYoutube', attrs: { videoId } },
        { type: 'paragraph' },
      ])
      .focus('end')
      .run();

    if (inserted) {
      skipExternalSyncRef.current = true;
      onChangeRef.current(getForumEditorMarkdown(editor));
    }

    requestAnimationFrame(() => {
      if (!editor.isDestroyed) editor.commands.focus('end');
    });
  }

  function insertMarkdownBlock(text) {
    if (!editor) return;
    editor.chain().focus().insertContent(`\n\n${text}\n`).run();
  }

  function wrapSelection(before, after, placeholderText) {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) {
      editor.chain().focus().insertContent(`${before}${placeholderText}${after}`).run();
      return;
    }
    const selected = editor.state.doc.textBetween(from, to);
    editor.chain().focus().insertContentAt({ from, to }, `${before}${selected}${after}`).run();
  }

  function syncEditorMarkdown(ed) {
    const md = getForumEditorMarkdown(ed);
    if (contentRef) contentRef.current = md;
    skipExternalSyncRef.current = true;
    onChangeRef.current(md);
    return md;
  }

  syncEditorMarkdownRef.current = syncEditorMarkdown;

  useEffect(() => {
    if (!flushRef) return undefined;
    flushRef.current = () => {
      const ed = editorRef.current;
      if (!ed || ed.isDestroyed) return valueRef.current || '';
      return syncEditorMarkdown(ed);
    };
    return () => {
      flushRef.current = null;
    };
  }, [flushRef, editor]);

  function insertLineBreak() {
    if (!editor) return;
    const inserted = editor.chain().focus().setHardBreak().run();
    if (inserted) syncEditorMarkdown(editor);
  }

  function insertHorizontalRule() {
    if (!editor) return;
    const inserted = editor.chain().focus().setHorizontalRule().run();
    if (inserted) syncEditorMarkdown(editor);
  }

  function openYoutubeDialog() {
    setYoutubeInput('');
    setYoutubeError('');
    setYoutubeDialogOpen(true);
    requestAnimationFrame(() => youtubeInputRef.current?.focus());
  }

  function closeYoutubeDialog() {
    setYoutubeDialogOpen(false);
    setYoutubeError('');
  }

  function confirmYoutubeInsert() {
    const input = youtubeInput.trim();
    if (!input) {
      setYoutubeError('請貼上 YouTube 連結或影片 ID。');
      return;
    }
    const videoId = extractYoutubeVideoId(input);
    if (!videoId) {
      setYoutubeError('無法辨識 YouTube 影片，請檢查連結格式。');
      return;
    }
    closeYoutubeDialog();
    insertYoutubeBlock(videoId);
  }

  function insertYoutube() {
    openYoutubeDialog();
  }

  function openPollDialog() {
    setPollTitle('投票');
    setPollOptionsText('選項一\n選項二\n選項三');
    setPollError('');
    setPollDialogOpen(true);
  }

  function closePollDialog() {
    setPollDialogOpen(false);
    setPollError('');
  }

  function confirmPollInsert() {
    const title = String(pollTitle || '投票').trim().slice(0, POLL_LIMITS.maxTitleLength) || '投票';
    const options = String(pollOptionsText || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, POLL_LIMITS.maxOptions)
      .map((line) => line.slice(0, POLL_LIMITS.maxOptionLength));

    if (options.length < POLL_LIMITS.minOptions) {
      setPollError(`請至少填寫 ${POLL_LIMITS.minOptions} 個選項（每行一個）。`);
      return;
    }

    if ((polls?.length || 0) >= POLL_LIMITS.maxPollsPerPost) {
      setPollError(`每篇貼文最多 ${POLL_LIMITS.maxPollsPerPost} 個投票。`);
      return;
    }

    const pollId = createPollId();
    const newPoll = { id: pollId, title, options };
    const nextPolls = [...(polls || []), newPoll];

    pollsRef.current = nextPolls;
    closePollDialog();
    insertPollBlock(pollId);
    onPollsChangeRef.current?.(nextPolls);
  }

  async function handleImagePick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadError('');
    setUploadProgress(0);
    setUploadFileName(file.name);
    setUploading(true);
    try {
      const url = await uploadForumImage(file, {
        onProgress: (percent) => setUploadProgress(percent),
      });
      const baseName = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || '圖片';
      const markdown = buildForumImageMarkdown(url, baseName);
      const ed = editorRef.current;

      if (ed && !ed.isDestroyed) {
        const inserted = ed.chain().focus().insertContent(markdown).run();
        if (inserted) {
          skipExternalSyncRef.current = true;
          onChangeRef.current(getForumEditorMarkdown(ed));
        } else {
          const next = [valueRef.current, markdown].filter(Boolean).join('\n\n');
          skipExternalSyncRef.current = true;
          onChangeRef.current(next);
        }
      } else {
        const next = [valueRef.current, markdown].filter(Boolean).join('\n\n');
        skipExternalSyncRef.current = true;
        onChangeRef.current(next);
      }
    } catch (err) {
      setUploadError(err?.message || '圖片上傳失敗');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadFileName('');
    }
  }

  const editorMarkdown = editor ? getForumEditorMarkdown(editor) : '';
  const charCount = editor
    ? (editorMarkdown.length || String(value || '').length)
    : String(value || '').length;
  const toolbarDisabled = disabled || uploading || !editor;

  if (!editor) {
    return (
      <div className="forum-tiptap">
        <LoadingText className="forum-compose-field__preview-empty" />
      </div>
    );
  }

  return (
    <div className="forum-tiptap">
      <div className="forum-compose-field__bar">
        <div className="forum-compose-field__tools" role="toolbar" aria-label="富文本格式">
          <button
            type="button"
            className={`forum-compose-field__tool forum-compose-field__tool--bold${editor?.isActive('bold') ? ' forum-compose-field__tool--active' : ''}`}
            title="粗體"
            disabled={toolbarDisabled}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            B
          </button>
          <button
            type="button"
            className={`forum-compose-field__tool forum-compose-field__tool--italic${editor?.isActive('italic') ? ' forum-compose-field__tool--active' : ''}`}
            title="斜體"
            disabled={toolbarDisabled}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            I
          </button>
          <button
            type="button"
            className="forum-compose-field__tool"
            title="隱藏內容"
            disabled={toolbarDisabled}
            onClick={() => wrapSelection('||', '||', '隱藏內容')}
          >
            劇透
          </button>
          {storyMode && (
            <button
              type="button"
              className="forum-compose-field__tool forum-compose-field__tool--break"
              title="段落內換行"
              disabled={toolbarDisabled}
              onClick={insertLineBreak}
            >
              換行
            </button>
          )}
          <button
            type="button"
            className="forum-compose-field__tool forum-compose-field__tool--hr"
            title="分隔線"
            disabled={toolbarDisabled}
            onClick={insertHorizontalRule}
          >
            <svg
              className="forum-compose-field__tool-icon"
              viewBox="0 0 16 16"
              aria-hidden="true"
            >
              <line x1="2.5" y1="5.5" x2="13.5" y2="5.5" />
              <line x1="2.5" y1="10.5" x2="13.5" y2="10.5" />
            </svg>
          </button>
          <button
            type="button"
            className="forum-compose-field__tool"
            title="插入投票"
            disabled={toolbarDisabled}
            onClick={openPollDialog}
          >
            📊
          </button>
          <button
            type="button"
            className="forum-compose-field__tool"
            title="嵌入 YouTube"
            disabled={toolbarDisabled}
            onClick={insertYoutube}
          >
            ▶
          </button>
          {imageUploadEnabled && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="forum-compose-field__file-input"
                onChange={handleImagePick}
                tabIndex={-1}
                aria-hidden="true"
              />
              <button
                type="button"
                className="forum-compose-field__tool forum-compose-field__tool--image"
                title="上傳圖片"
                disabled={toolbarDisabled}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? '…' : '🖼'}
              </button>
            </>
          )}
        </div>
        <span className="forum-compose-field__count forum-tiptap__count">{charCount}/{maxLength}</span>
      </div>

      {uploading && (
        <div className="forum-compose-upload-progress" role="status" aria-live="polite" aria-busy="true">
          <div className="forum-compose-upload-progress__head">
            <span className="forum-compose-upload-progress__label">上傳圖片中…</span>
            <span className="forum-compose-upload-progress__pct">{uploadProgress}%</span>
          </div>
          {uploadFileName && (
            <p className="forum-compose-upload-progress__file">{uploadFileName}</p>
          )}
          <div className="forum-compose-upload-progress__track" aria-hidden="true">
            <div
              className="forum-compose-upload-progress__fill"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className="forum-tiptap__editor-wrap forum-compose-field__editor-wrap">
        <EditorContent editor={editor} className="forum-tiptap__editor pixel-textarea" />
        {mentionOpen && (
          <div className="forum-mention-picker" role="listbox">
            {mentionLoading && <p className="forum-mention-picker__hint">搜尋中…</p>}
            {!mentionLoading && mentionItems.length === 0 && (
              <p className="forum-mention-picker__hint">找不到符合的會員</p>
            )}
            {mentionItems.map((user, index) => (
              <button
                key={user.id}
                type="button"
                role="option"
                aria-selected={index === mentionIndex}
                className={`forum-mention-picker__item${index === mentionIndex ? ' forum-mention-picker__item--active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyMention(user)}
              >
                @{user.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {uploadError && (
        <p className="forum-compose-field__upload-error" role="alert">{uploadError}</p>
      )}

      {pollDialogOpen && (
        <ForumEditorOverlay
          open={pollDialogOpen}
          onClose={closePollDialog}
          title="📊 新增投票"
          titleId="forum-poll-compose-title"
        >
          <label className="forum-poll-compose__field">
            <span>標題</span>
            <input
              type="text"
              className="pixel-input"
              value={pollTitle}
              onChange={(e) => setPollTitle(e.target.value)}
              maxLength={POLL_LIMITS.maxTitleLength}
              placeholder="投票"
            />
          </label>
          <label className="forum-poll-compose__field">
            <span>選項（每行一個，2–6 項）</span>
            <textarea
              className="pixel-textarea forum-poll-compose__options"
              value={pollOptionsText}
              onChange={(e) => setPollOptionsText(e.target.value)}
              rows={5}
              placeholder={'選項一\n選項二\n選項三'}
            />
          </label>
          {pollError && <p className="pixel-error forum-poll-compose__error">{pollError}</p>}
          <div className="forum-poll-compose__actions">
            <button type="button" className="forum-poll-compose__cancel" onClick={closePollDialog}>
              取消
            </button>
            <button type="button" className="forum-poll-compose__submit" onClick={confirmPollInsert}>
              提交
            </button>
          </div>
        </ForumEditorOverlay>
      )}

      {youtubeDialogOpen && (
        <ForumEditorOverlay
          open={youtubeDialogOpen}
          onClose={closeYoutubeDialog}
          title="▶ 嵌入 YouTube"
          titleId="forum-youtube-compose-title"
        >
          <p className="forum-poll-compose__hint">
            支援 youtube.com、youtu.be 連結，或直接貼上 11 碼影片 ID
          </p>
          <label className="forum-poll-compose__field">
            <span>影片連結或 ID</span>
            <input
              ref={youtubeInputRef}
              type="url"
              className="pixel-input"
              value={youtubeInput}
              onChange={(e) => {
                setYoutubeInput(e.target.value);
                if (youtubeError) setYoutubeError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  confirmYoutubeInsert();
                }
                if (e.key === 'Escape') closeYoutubeDialog();
              }}
              placeholder="https://www.youtube.com/watch?v=..."
              autoComplete="off"
            />
          </label>
          {youtubeError && <p className="pixel-error forum-poll-compose__error">{youtubeError}</p>}
          <div className="forum-poll-compose__actions">
            <button type="button" className="forum-poll-compose__cancel" onClick={closeYoutubeDialog}>
              取消
            </button>
            <button type="button" className="forum-poll-compose__submit" onClick={confirmYoutubeInsert}>
              提交
            </button>
          </div>
        </ForumEditorOverlay>
      )}
    </div>
  );
}
