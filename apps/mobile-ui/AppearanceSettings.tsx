import React, { useState } from 'react'
import { ThemeConfig, PRESET_COLORS, PRESET_BACKGROUNDS, saveTheme } from './theme'

interface AppearanceSettingsProps {
  theme: ThemeConfig
  setTheme: React.Dispatch<React.SetStateAction<ThemeConfig>>
}

export function AppearanceSettings({ theme, setTheme }: AppearanceSettingsProps) {
  const [open, setOpen] = useState(false)

  const update = (patch: Partial<ThemeConfig>) => {
    setTheme(prev => {
      const next = { ...prev, ...patch }
      saveTheme(next)
      return next
    })
  }

  const handleUploadBg = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        update({
          bgPreset: 'custom',
          customBgBase64: reader.result
        })
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <section className="ios-settings-card">
      <div className="section-title">
        <h2>界面与个性化</h2>
        <span className="tag">iOS 风格</span>
      </div>
      <p className="caption">自由定制心仪的背景、气泡质感与色彩，让故事更有专属温度。</p>

      {/* 色彩选择 */}
      <div className="ios-form-group">
        <label className="ios-label">主题强调色</label>
        <div className="color-palette">
          {PRESET_COLORS.map(c => (
            <button
              key={c.accent}
              type="button"
              className={`color-pill ${theme.accent === c.accent ? 'active' : ''}`}
              style={{ backgroundColor: c.accent }}
              onClick={() => update({ accent: c.accent, accentSoft: c.soft, accentShadow: c.shadow })}
              aria-label={c.name}
              title={c.name}
            >
              {theme.accent === c.accent && <span className="color-check">✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* 气泡与排版 */}
      <div className="field-pair">
        <label>
          气泡风格
          <select
            value={theme.bubbleStyle}
            onChange={e => update({ bubbleStyle: e.target.value as ThemeConfig['bubbleStyle'] })}
          >
            <option value="glass">iOS 琉璃毛玻璃 (推荐)</option>
            <option value="paper">经典纸质文学</option>
            <option value="novel">沉浸无边框 (轻小说)</option>
          </select>
        </label>
        <label>
          正文字体
          <select
            value={theme.fontFamily}
            onChange={e => update({ fontFamily: e.target.value as ThemeConfig['fontFamily'] })}
          >
            <option value="serif">文学宋体 (沉浸慢热)</option>
            <option value="sans">现代黑体 (轻快日常)</option>
          </select>
        </label>
      </div>

      {/* 背景与毛玻璃调节折叠区 */}
      <details className="ios-details" open={open} onToggle={e => setOpen(e.currentTarget.open)}>
        <summary>背景壁纸与毛玻璃微调</summary>
        <div className="bg-customizer">
          <label className="ios-label">背景预设</label>
          <div className="bg-presets">
            <button
              type="button"
              className={`preset-btn ${theme.bgPreset === 'none' ? 'active' : ''}`}
              onClick={() => update({ bgPreset: 'none' })}
            >
              经典纸质
            </button>
            <button
              type="button"
              className={`preset-btn ${theme.bgPreset === 'frosted-glass' ? 'active' : ''}`}
              onClick={() => update({ bgPreset: 'frosted-glass' })}
            >
              极光微蓝
            </button>
            <button
              type="button"
              className={`preset-btn ${theme.bgPreset === 'sunset' ? 'active' : ''}`}
              onClick={() => update({ bgPreset: 'sunset' })}
            >
              暮色落樱
            </button>
            <button
              type="button"
              className={`preset-btn ${theme.bgPreset === 'night' ? 'active' : ''}`}
              onClick={() => update({ bgPreset: 'night' })}
            >
              深邃星夜
            </button>
          </div>

          <div className="custom-upload-box">
            <label className="upload-btn primary">
              <span>{theme.customBgBase64 ? '更换自定义壁纸' : '上传自定义壁纸 / 立绘'}</span>
              <input type="file" accept="image/*" onChange={handleUploadBg} style={{ display: 'none' }} />
            </label>
            {theme.customBgBase64 && (
              <button
                type="button"
                className="text-button danger"
                onClick={() => update({ bgPreset: 'none', customBgBase64: undefined })}
              >
                移除当前图片
              </button>
            )}
          </div>

          {(theme.bgPreset !== 'none' || theme.customBgBase64) && (
            <div className="sliders-panel">
              <label className="slider-item">
                <div className="slider-header">
                  <span>毛玻璃模糊度</span>
                  <span>{theme.bgBlur}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  step="1"
                  value={theme.bgBlur}
                  onChange={e => update({ bgBlur: Number(e.target.value) })}
                />
              </label>

              <label className="slider-item">
                <div className="slider-header">
                  <span>背景遮罩暗度</span>
                  <span>{Math.round(theme.bgDim * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.75"
                  step="0.05"
                  value={theme.bgDim}
                  onChange={e => update({ bgDim: Number(e.target.value) })}
                />
              </label>
            </div>
          )}
        </div>
      </details>
    </section>
  )
}
