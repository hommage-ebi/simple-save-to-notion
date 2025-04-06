import '../scss/theme.scss';
import UIKit from 'uikit';
import Icons from 'uikit/dist/js/uikit-icons';
import Mustache from 'mustache';
import NotionClient from './notion.js';
import thenChrome from 'then-chrome';
import webPageParser from './parsers.js';

UIKit.use(Icons);

const TEST_URL = 'https://example.com';

class UI {
  constructor() {
    this.client = new NotionClient();
    this.notionPageId = null; // 保存したNotionページのIDを保持
    
    // 初期化順序を調整
    this.setupButtons();
    this.setupMsgHandler();
    
    // ポップアップ表示時の処理を開始
    this.initializePopup();
  }
  
  // ポップアップの初期化処理を一元管理
  async initializePopup() {
    document.addEventListener('DOMContentLoaded', async () => {
      console.log('ポップアップが表示されました - 初期化処理を開始します');
      
      try {
        // ローディング表示
        this.showLoading(true);
        
        // 1. Notionとの接続確立
        await this.connectionTest();
        
        // 2. 現在のタブ情報を取得
        await this.getCurrentTabInfo();
        
        // 3. データベースIDが設定されているか確認
        const databaseId = await this.client.getDatabaseId();
        if (!databaseId) {
          this.renderMessage('danger', 'データベースIDが設定されていません。オプション画面で設定してください。');
          this.showLoading(false);
          return;
        }
        
        // 4. 重複チェック
        if (this.client.token) {
          await this.checkDuplicate();
        }
      } catch (error) {
        console.error('初期化処理エラー:', error);
        this.renderMessage('danger', `エラー: ${error.message}`);
      } finally {
        // ローディング非表示
        this.showLoading(false);
      }
    });
  }

  // 現在のタブ情報を取得
  async getCurrentTabInfo() {
    console.log('現在のタブ情報を取得します');
    
    // 現在のタブ情報を取得
    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs);
      });
    });
    
    const url = tabs[0].url;
    console.log('現在のタブURL:', url);
    
    // ページ情報を取得
    this.data = await (this.isDebugUrl(url)
      ? this.getPageInfo(TEST_URL)
      : this.getPageInfo(url));
    
    console.log('ページ情報を取得しました:', this.data);
    
    return this.data;
  }
  
  // トークンが取得されるまで待機
  async waitForToken(maxAttempts = 5) {
    console.log('トークン取得を待機中...');
    let attempts = 0;
    
    while (!this.client.token && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 300));
      attempts++;
    }
    
    if (!this.client.token) {
      throw new Error('Notionトークンの取得に失敗しました。Notionにログインしているか確認してください。');
    }
    
    console.log('トークンが取得されました');
  }

  async connectionTest() {
    try {
      console.log('Notionとの接続テストを開始します');
      
      // botIdを取得
      const botId = await new Promise((resolve) => {
        chrome.storage.local.get('botId', (d) => {
          resolve(d.botId);
        });
      });
      
      if (!botId) {
        console.error('Notion Integration IDが設定されていません');
        this.renderMessage('danger', 'Notion Integration IDが設定されていません。オプション画面で設定してください。');
        return;
      }
      
      console.log('Notionトークンをリクエストします');
      const data = await this.client.requestToken(botId);
      
      if (data.name == 'UnauthorizedError') {
        console.error('Notionへの認証に失敗しました');
        this.renderMessage('danger', 'Notionにログインしていません。Notionにログインしてから再試行してください。');
      } else {
        console.log('Notionトークンを取得しました');
        this.client.token = data.token;
      }
    } catch (error) {
      console.error('接続テストエラー:', error);
      this.renderMessage('danger', `Notionとの接続エラー: ${error.message}`);
    }
  }

  // 重複チェックを行う
  async checkDuplicate() {
    try {
      if (!this.data || !this.client.token) return;
      
      // ローディング表示
      this.showLoading(true);
      
      try {
        // 重複チェック（データベースIDはNotionクラス内で取得）
        const entries = await this.client.checkDuplicateEntry(this.data.id);
        
        if (entries && entries.length > 0) {
          // 既に保存されている場合
          this.notionPageId = entries[0].id;
          
          // ボタンの表示を切り替え
          document.getElementById('js-save').style.display = 'none';
          document.getElementById('js-view').style.display = 'inline-block';
          
          // タイトル、説明のフィールドを編集不可にする
          document.getElementById('js-title').disabled = true;
          document.getElementById('js-abst').disabled = true;
          
          // 編集不可であることを視覚的に示すためにスタイルを変更
          document.getElementById('js-title').style.opacity = '0.7';
          document.getElementById('js-abst').style.opacity = '0.7';
        } else {
          // まだ保存されていない場合
          document.getElementById('js-save').style.display = 'inline-block';
          document.getElementById('js-view').style.display = 'none';
          
          // タイトルと説明のフィールドを編集可能にする
          document.getElementById('js-title').disabled = false;
          document.getElementById('js-abst').disabled = false;
          
          // スタイルを元に戻す
          document.getElementById('js-title').style.opacity = '1';
          document.getElementById('js-abst').style.opacity = '1';
        }
      } catch (error) {
        console.error('Error checking duplicate:', error);
        if (error.message.includes('データベースIDが設定されていません')) {
          this.renderMessage('danger', 'データベースIDが設定されていません。オプション画面で設定してください。');
        } else {
          this.renderMessage('danger', `Notionとの通信エラー: ${error.message}`);
        }
      } finally {
        // ローディング非表示
        this.showLoading(false);
      }
    } catch (error) {
      console.error('Unexpected error in checkDuplicate:', error);
      this.renderMessage('danger', `予期せぬエラーが発生しました: ${error.message}`);
      this.showLoading(false);
    }
  }

  setupButtons() {
    // Save ボタンの設定
    document.getElementById('js-save').addEventListener('click', async () => {
      try {
        // ローディング表示
        this.showLoading(true);
        
        // this.dataがundefinedでないことを確認
        if (!this.data) {
          throw new Error('ページデータがまだ読み込まれていません。もう一度お試しください。');
        }
        
        // フォームから最新の値を取得して、データを更新
        // 現在の日時（時間を含む）を取得
        const now = new Date();
        const isoDateTime = now.toISOString(); // ISO形式の日時（YYYY-MM-DDTHH:mm:ss.sssZ）
        
        const updatedData = {
          ...this.data,
          title: document.getElementById('js-title').value,
          description: document.getElementById('js-abst').value,
          savedAt: isoDateTime // 日付と時間を含むISO形式の日時
        };
        
        // 更新したデータで保存
        const result = await this.client.createPage(updatedData);
        if (result.status && result.status == 400) {
          this.renderMessage('danger', `[${result.code}] ${result.message}`);
          return;
        } else {
          // 保存成功時
          this.notionPageId = result.id;
          
          // ボタンの表示を切り替え
          document.getElementById('js-save').style.display = 'none';
          document.getElementById('js-view').style.display = 'inline-block';
          
          // タイトル、説明のフィールドを編集不可にする
          document.getElementById('js-title').disabled = true;
          document.getElementById('js-abst').disabled = true;
          
          // 編集不可であることを視覚的に示すためにスタイルを変更
          document.getElementById('js-title').style.opacity = '0.7';
          document.getElementById('js-abst').style.opacity = '0.7';
        }
      } catch (error) {
        console.error('Error saving to Notion:', error);
        this.renderMessage('danger', `Notionへの保存エラー: ${error.message}`);
      } finally {
        // ローディング非表示
        this.showLoading(false);
      }
    });
    
    // View in Notion ボタンの設定
    document.getElementById('js-view').addEventListener('click', () => {
      if (this.notionPageId) {
        thenChrome.tabs.create({
          url: `https://notion.so/${this.notionPageId.replaceAll('-', '')}`,
        });
      } else {
        this.renderMessage('danger', 'NotionページIDが見つかりません。');
      }
    });
  }
  
  // ローディング表示の切り替え
  showLoading(isLoading) {
    const saveButton = document.getElementById('js-save');
    const viewButton = document.getElementById('js-view');
    const saveText = document.getElementById('js-save-text');
    const saveSpinner = document.getElementById('js-save-spinner');
    const viewText = document.getElementById('js-view-text');
    const viewSpinner = document.getElementById('js-view-spinner');
    
    if (isLoading) {
      // ボタンを無効化
      saveButton.disabled = true;
      viewButton.disabled = true;
      
      // 表示されているボタンのスピナーを表示
      if (saveButton.style.display !== 'none') {
        saveText.style.display = 'none';
        saveSpinner.style.display = 'inline-block';
      }
      
      if (viewButton.style.display !== 'none') {
        viewText.style.display = 'none';
        viewSpinner.style.display = 'inline-block';
      }
    } else {
      // ボタンを有効化
      saveButton.disabled = false;
      viewButton.disabled = false;
      
      // スピナーを非表示にしてテキストを表示
      saveText.style.display = 'inline';
      saveSpinner.style.display = 'none';
      viewText.style.display = 'inline';
      viewSpinner.style.display = 'none';
    }
  }

  setupMsgHandler() {
    // 通常のメッセージイベント
    document.addEventListener('msg', (evt) => {
      console.error(evt);
      this.renderMessage(evt.detail.type, evt.detail.msg);
    });
    
    // Notionページが見つかった時のイベント
    document.addEventListener('notion-page-found', (evt) => {
      console.log('Notion page found:', evt.detail);
      
      // NotionページIDを保存
      this.notionPageId = evt.detail.id;
      
      // Notionから取得したタイトルと説明をフォームに表示
      if (evt.detail.title) {
        document.getElementById('js-title').value = evt.detail.title;
      }
      
      if (evt.detail.description) {
        document.getElementById('js-abst').value = evt.detail.description;
      }
    });
  }
  
  isDebugUrl(url) {
    return url?.startsWith('chrome-extension://') || false;
  }
  
  async getPageInfo(url) {
    try {
      // chrome.scripting APIを使用してOGPデータを取得
      const data = await webPageParser.parse(url);
      
      // デバッグ情報（コンソールのみ）
      console.log('Page data retrieved:', data);
      
      if (data.description) {
        console.log('Description found:', data.description);
      } else {
        console.log('No description found');
      }
      
      if (data.image) {
        console.log('Image URL found:', data.image);
      } else {
        console.log('No image URL found');
      }
      
      this.setFormContents(data);
      return data;
    } catch (error) {
      console.error('Error parsing page:', error);
      this.renderMessage('danger', `Error parsing page: ${error.message}`);
      
      // エラーが発生した場合でも基本的な情報を表示
      const basicData = {
        id: url,
        title: 'Failed to parse page',
        description: 'Error occurred while parsing the page',
        url: url,
        savedAt: new Date().toISOString().split('T')[0],
        image: ''
      };
      
      this.setFormContents(basicData);
      return basicData;
    }
  }
  
  setFormContents(data) {
    // Set title and description
    document.getElementById('js-title').value = data.title || '';
    document.getElementById('js-abst').value = data.description || '';
    
    // 日付表示とjs-chip-containerは削除（ユーザーリクエストにより）
    // OGP Image Previewも削除（ユーザーリクエストにより）
  }

  renderMessage(type, message, overwrite = false) {
    // type: warning, danger, success, primary
    const template = `<div class="uk-alert-{{type}}" uk-alert><a class="uk-alert-close" uk-close></a><p>{{message}}</p></div>`;
    const rendered = Mustache.render(template, {
      type: type,
      message: message,
    });
    if (overwrite) {
      document.getElementById('js-message-container').innerHTML = rendered;
    } else {
      document
        .getElementById('js-message-container')
        .insertAdjacentHTML('beforeend', rendered);
    }
  }
}

new UI();
