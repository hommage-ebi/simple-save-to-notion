import '../scss/theme.scss';
import UIKit from 'uikit';
import Icons from 'uikit/dist/js/uikit-icons';
import Mustache from 'mustache';
import NotionClient from './notion.js';

UIKit.use(Icons);

class TokenManager {
  constructor() {
    this.botIdKey = 'botId';
    this.databaseIdKey = 'databaseId';
    this.setupInput();
    this.setupSaveButton();
    this.client = new NotionClient();
    
    // 初期接続ステータスの表示
    this.checkInitialStatus();
  }
  
  // 初期接続ステータスの確認
  async checkInitialStatus() {
    try {
      // 保存されたIntegration IDとDatabase IDを確認
      chrome.storage.local.get([this.botIdKey, this.databaseIdKey], async (data) => {
        const botId = data[this.botIdKey];
        const databaseId = data[this.databaseIdKey];
        
        // ステータスメッセージを表示
        if (!botId) {
          this.renderMessage('warning', 'Notion Integration IDが設定されていません。', true);
        } else if (!databaseId) {
          this.renderMessage('warning', 'Notion Database IDが設定されていません。', true);
        } else {
          // 接続テスト
          try {
            const tokenData = await this.client.requestToken(botId);
            if (tokenData.name === 'UnauthorizedError') {
              this.renderMessage('danger', 'Notionにログインしていません。Notionにログインしてから再試行してください。', true);
            } else {
              this.renderMessage('success', 'Notionとの接続が確立されています。', true);
            }
          } catch (error) {
            this.renderMessage('danger', `接続エラー: ${error.message}`, true);
          }
        }
      });
    } catch (error) {
      console.error('初期ステータス確認エラー:', error);
    }
  }
  toggleVisible() {
    if (this.input.type == 'password') {
      this.input.type = 'text';
      this.visibleButton.setAttribute('uk-icon', 'unlock');
    } else {
      this.input.type = 'password';
      this.visibleButton.setAttribute('uk-icon', 'lock');
    }
  }
  setupSaveButton() {
    // インテグレーションID保存ボタン
    this.saveButton = document.getElementById('js-save-btn');
    this.saveButton.addEventListener('click', () => {
      this.saveIntegrationId();
    });
    
    // パスワード表示切替ボタン
    this.visibleButton = document.getElementById('js-visible-btn');
    this.visibleButton.addEventListener('click', () => {
      this.toggleVisible();
    });
    
    // データベースID保存ボタン
    this.saveDatabaseButton = document.getElementById('js-save-db-btn');
    this.saveDatabaseButton.addEventListener('click', () => {
      this.saveDatabaseId();
    });
  }
  setupInput() {
    // インテグレーションID入力欄
    this.input = document.getElementById('js-token-input');
    
    // データベースID入力欄
    this.databaseInput = document.getElementById('js-database-input');
    
    if (!chrome.storage) return;
    
    // 保存されたインテグレーションIDを読み込む
    chrome.storage.local.get(this.botIdKey, (d) => {
      if (!d) return;
      this.input.value = d.botId;
    });
    
    // 保存されたデータベースIDを読み込む
    chrome.storage.local.get(this.databaseIdKey, (d) => {
      if (!d) return;
      this.databaseInput.value = d.databaseId;
    });
  }
  async saveIntegrationId() {
    const botId = this.input.value;
    if (!botId.trim().length || botId.length != 36) {
      console.log('invalid!');
      this.renderMessage('danger', 'Invalid integration ID (36 char).');
      return;
    }
    console.log(botId);
    await chrome.storage.local.set({
      botId: botId,
    });
    chrome.storage.local.get(this.botIdKey, (d) => {
      console.log('chrome storage', d);
      this.renderMessage('success', 'Integration ID is successfully saved.');
      this.connectionTest();
    });
  }
  
  async saveDatabaseId() {
    const databaseId = this.databaseInput.value;
    if (!databaseId.trim().length) {
      console.log('empty database ID!');
      this.renderMessage('danger', 'Database ID cannot be empty.');
      return;
    }
    
    console.log('Saving database ID:', databaseId);
    await chrome.storage.local.set({
      databaseId: databaseId,
    });
    
    chrome.storage.local.get(this.databaseIdKey, (d) => {
      console.log('chrome storage (database ID):', d);
      this.renderMessage('success', 'Database ID is successfully saved.');
    });
  }
  async connectionTest() {
    chrome.storage.local.get(this.botIdKey, (d) => {
      const botId = d.botId;
      const data = this.client.requestToken(botId);
      console.log(data);
      if (data.name == 'UnauthorizedError') {
        this.renderMessage('danger', 'You are not logged in notion.so.');
      } else {
        this.renderMessage('success', 'Successfully connected with notion.so.');
      }
    });
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

new TokenManager();
