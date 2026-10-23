/**
 * Reliable JSON downloader that works inside iframes and standard browsers
 */
export function downloadJsonFile(data: any, filename: string): boolean {
  try {
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    
    // Method 1: Blob URL download
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const blobUrl = window.URL.createObjectURL(blob);
    
    const tempLink = document.createElement('a');
    tempLink.href = blobUrl;
    tempLink.setAttribute('download', filename);
    tempLink.style.display = 'none';
    document.body.appendChild(tempLink);
    tempLink.click();
    
    setTimeout(() => {
      document.body.removeChild(tempLink);
      window.URL.revokeObjectURL(blobUrl);
    }, 250);

    return true;
  } catch (err) {
    console.warn('Blob download attempt failed, attempting Data URI fallback:', err);
    try {
      // Method 2: Data URI fallback
      const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(jsonString)}`;
      const tempLink = document.createElement('a');
      tempLink.href = dataUri;
      tempLink.setAttribute('download', filename);
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      return true;
    } catch (fallbackErr) {
      console.error('All automatic download methods failed:', fallbackErr);
      return false;
    }
  }
}

/**
 * Copy text to clipboard with fallback for older browsers or restricted iframes
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('navigator.clipboard failed, attempting execCommand fallback:', err);
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Copy to clipboard failed:', err);
    return false;
  }
}
