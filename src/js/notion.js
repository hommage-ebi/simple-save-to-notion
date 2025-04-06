export default class Notion {
  constructor() {
    this.token = null;
    this.apiBase = 'https://api.notion.com/v1/';
  }

  torkenizedHeaders() {
    return {
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
      Authorization: `Bearer ${this.token}`,
    };
  }

  async requestToken(botId) {
    const url = 'https://www.notion.so/api/v3/getBotToken';
    const body = { botId: botId };
    const headers = {
      Accept: 'application/json, */*',
      'Content-type': 'application/json',
    };
    const res = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: headers,
      credentials: 'include',
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data;
  }

  async retrievePage(pageId) {
    try {
      const url = this.apiBase + `pages/${pageId}`;
      const res = await fetch(url, {
        method: 'GET',
        mode: 'cors',
        headers: this.torkenizedHeaders(),
      });
      const data = await res.json();
      console.log(data);
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async checkDuplicateEntry(pageId) {
    console.log('Checking for duplicate entry with ID:', pageId);
    
    // 保存されたデータベースIDを取得
    const databaseId = await this.getDatabaseId();
    if (!databaseId) {
      throw new Error('データベースIDが設定されていません。オプション画面で設定してください。');
    }
    
    // URLで検索
    const filter = {
      property: 'URL',
      url: {
        equals: pageId
      }
    };
    
    const url = this.apiBase + `databases/${databaseId}/query`;
    const body = {
      filter: filter
    };
    
    console.log('Sending query to Notion API:', JSON.stringify(body, null, 2));
    
    const res = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: this.torkenizedHeaders(),
      body: JSON.stringify(body)
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error('Notion API error details:', errorData);
      throw new Error(`Notion API エラー: ${res.status} - ${errorData.message || ''}`);
    }
    
    const data = await res.json();
    const entries = data.results || [];
    
    if (entries.length > 0) {
      console.log('Found duplicate entry:', entries[0].id);
      
      // Notionから取得したデータを抽出
      const entry = entries[0];
      console.log('Notion entry data:', entry);
      
      // タイトルを抽出
      let title = '';
      if (entry.properties.Title && entry.properties.Title.title && entry.properties.Title.title.length > 0) {
        title = entry.properties.Title.title[0].text.content;
      }
      
      // 説明を抽出
      let description = '';
      if (entry.properties.Description && entry.properties.Description.rich_text && entry.properties.Description.rich_text.length > 0) {
        description = entry.properties.Description.rich_text[0].text.content;
      }
      
      console.log('Extracted title:', title);
      console.log('Extracted description:', description);
      
      // イベントを発火して、UIクラスにNotionのデータを設定
      document.dispatchEvent(
        new CustomEvent('notion-page-found', {
          detail: {
            id: entry.id,
            title: title,
            description: description
          }
        })
      );
      
    } else {
      console.log('No duplicate entry found');
    }
    
    return entries;
  }


  // データベースIDを取得するヘルパーメソッド
  getDatabaseId() {
    return new Promise((resolve) => {
      chrome.storage.local.get('databaseId', (data) => {
        resolve(data.databaseId || null);
      });
    });
  }

  async createPage(pageData) {
    if (!pageData) {
      throw new Error('ページデータが提供されていません');
    }
    
    // 保存されたデータベースIDを取得
    const databaseId = await this.getDatabaseId();
    if (!databaseId) {
      throw new Error('データベースIDが設定されていません。オプション画面で設定してください。');
    }

    // 既に保存されているかチェック
    const duplicateEntries = await this.checkDuplicateEntry(pageData.id);
    if (duplicateEntries.length != 0) {
      console.log('ページは既に保存されています。既存のエントリを返します。');
      return duplicateEntries[0];
    }

    // 説明が長すぎる場合は切り詰める（Notionのrich_textは2000文字の制限がある）
    const truncatedDescription = pageData.description ? pageData.description.substring(0, 1900) : '';
    const truncatedTitle = pageData.title ? pageData.title.substring(0, 1900) : 'タイトルなし';
    
    const url = this.apiBase + 'pages';
    const parent = {
      type: 'database_id',
      database_id: databaseId,
    };
    
    // プロパティオブジェクトを作成
    const properties = {
      // タイトル
      Title: {
        id: 'title',
        type: 'title',
        title: [{ text: { content: truncatedTitle } }],
      },
      
      // URL
      URL: {
        id: 'url',
        type: 'url',
        url: pageData.url,
      },
      
      // 説明
      Description: {
        id: 'description',
        type: 'rich_text',
        rich_text: [
          {
            type: 'text',
            text: { content: truncatedDescription, link: null },
            annotations: {
              bold: false,
              italic: true,
              strikethrough: false,
              underline: false,
              code: false,
              color: 'default',
            },
            plain_text: truncatedDescription,
            href: null,
          },
        ],
      },
      
      // 保存日時
      "Saved At": {
        id: 'published', // published フィールドを保存日時用に再利用
        type: 'date',
        date: { start: pageData.savedAt, end: null },
      },
    };
    
    // 画像URLが利用可能で有効な場合、画像プロパティに追加
    if (pageData.image && pageData.image.startsWith('http')) {
      properties.Image = {
        files: [
          {
            type: "external",
            name: "Image",
            external: {
              url: pageData.image
            }
          }
        ]
      };
    }

    const body = {
      parent: parent,
      properties: properties,
    };
    
    console.log('Notionにページを作成します:', JSON.stringify(body, null, 2));
    
    const res = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: this.torkenizedHeaders(),
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error('Notion API error details:', errorData);
      throw new Error(`Notion API エラー: ${res.status} - ${errorData.message || ''}`);
    }
    
    const data = await res.json();
    console.log('Notionページが作成されました:', data.id);
    
    return data;
  }

  // データベース一覧取得メソッド（オプション画面で使用する場合のために残しておく）
  async retrieveDatabase() {
    try {
      // /v1/databases is deprecated since Notion API version: 2022-06-28
      // https://developers.notion.com/reference/get-databases
      // https://developers.notion.com/reference/post-search
      const url = this.apiBase + 'search';
      const headers = this.torkenizedHeaders();
      const body = { filter: { value: 'database', property: 'object' } };
      const res = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      return data.results || [];
    } catch (err) {
      console.error(err);
      throw err;
    }
  }
}
