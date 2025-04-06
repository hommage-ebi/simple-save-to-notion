class WebPageParser {
  constructor() {}

  async parse(url) {
    return new Promise((resolve, reject) => {
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
          if (!tabs || tabs.length === 0) {
            reject(new Error('No active tab found'));
            return;
          }
          
          const activeTab = tabs[0];
          
          // 基本情報を取得
          const basicData = {
            id: url,
            title: activeTab.title || 'No Title',
            url: url,
            savedAt: new Date().toISOString().split('T')[0],
            description: '',
            image: ''
          };
          
          try {
            // コンテンツスクリプトを使用してOGPデータを取得
            chrome.scripting.executeScript(
              {
                target: { tabId: activeTab.id },
                // thisのコンテキストが失われないように、関数を直接定義
                func: function() {
                  try {
                    // すべてのOGPタグを取得してコンソールに出力（デバッグ用）
                    const allOgTags = document.querySelectorAll('meta[property^="og:"]');
                    console.log('All OG tags:', Array.from(allOgTags).map(tag => ({
                      property: tag.getAttribute('property'),
                      content: tag.getAttribute('content')
                    })));
                    
                    const data = {
                      description: '',
                      imageUrl: ''
                    };
                    
                    // OGP説明を取得
                    const metaDescription = document.querySelector('meta[property="og:description"]');
                    if (metaDescription) {
                      data.description = metaDescription.getAttribute('content');
                      console.log('OG description found:', data.description);
                    } else {
                      const fallbackDescription = document.querySelector('meta[name="description"]');
                      if (fallbackDescription) {
                        data.description = fallbackDescription.getAttribute('content');
                        console.log('Fallback description found:', data.description);
                      } else {
                        console.log('No description found');
                      }
                    }
                    
                    // OGP画像を取得
                    const metaImage = document.querySelector('meta[property="og:image"]');
                    if (metaImage) {
                      data.imageUrl = metaImage.getAttribute('content');
                      console.log('OG image found:', data.imageUrl);
                    } else {
                      console.log('No OG image found');
                    }
                    
                    return data;
                  } catch (error) {
                    console.error('Error in content script:', error);
                    return {
                      description: '',
                      imageUrl: ''
                    };
                  }
                }
              }, 
              (results) => {
                if (chrome.runtime.lastError) {
                  console.error('Script execution error:', chrome.runtime.lastError);
                  resolve(basicData); // エラーが発生しても基本データを返す
                  return;
                }
                
                if (results && results[0] && results[0].result) {
                  const extractedData = results[0].result;
                  console.log('Extracted OGP data:', extractedData);
                  
                  // 取得したデータを統合
                  if (extractedData.description) {
                    basicData.description = extractedData.description;
                  }
                  
                  if (extractedData.imageUrl) {
                    basicData.image = extractedData.imageUrl;
                  }
                }
                
                resolve(basicData);
              }
            );
          } catch (error) {
            console.error('Error executing content script:', error);
            resolve(basicData); // エラーが発生しても基本データを返す
          }
        });
      } catch (error) {
        console.error('Error in parse method:', error);
        reject(error);
      }
    });
  }
}

const webPageParser = new WebPageParser();
export default webPageParser;
