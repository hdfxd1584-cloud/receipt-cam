import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, X, Image as ImageIcon, Save, Trash2, Check, ChevronLeft, Loader2 } from 'lucide-react';

/**
 * レシート保存カメラアプリ (App.jsx)
 * iPhoneのホーム画面に追加して使用することを想定した、
 * iCloud Driveへのレシート保存に特化したアプリケーションです。
 */
export default function App() {
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [saveList, setSaveList] = useState([]);
  const [facingMode, setFacingMode] = useState('environment'); // 背面カメラをデフォルト
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // カメラを起動する処理
  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: facingMode, 
          width: { ideal: 1920 }, 
          height: { ideal: 1080 } 
        },
        audio: false
      });
      
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error("カメラの起動に失敗しました:", err);
    }
  };

  // 初回起動時およびカメラ切り替え時に実行
  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  // シャッターを切る処理
  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // カメラの実際の解像度をキャンバスに設定
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // JPEGとしてデータURL化（画質 0.85）
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
  };

  // iCloud / ファイルアプリへの保存処理
  const saveToFiles = async (imageData) => {
    setIsSaving(true);
    const timestamp = new Date().toLocaleString('ja-JP').replace(/[/ :]/g, '-');
    const fileName = `Receipt_${timestamp}.jpg`;
    
    try {
      const res = await fetch(imageData);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: 'image/jpeg' });

      // iOS標準の共有シートを呼び出す（iCloud保存を選択可能にする）
      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: 'レシートの保存',
        });
        
        // 保存成功（共有完了）後に履歴へ追加
        setSaveList(prev => [{ id: Date.now(), url: imageData, name: fileName }, ...prev]);
        setCapturedImage(null);
      } else {
        // PCブラウザ等の場合は通常ダウンロード
        const link = document.createElement('a');
        link.href = imageData;
        link.download = fileName;
        link.click();
      }
    } catch (err) {
      console.error("保存プロセス中にエラーが発生しました:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // 前面・背面カメラの切り替え
  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white font-sans overflow-hidden">
      {/* 上部ステータスバー */}
      <header className="p-4 flex justify-between items-center bg-gray-900 border-b border-gray-800 z-30 shrink-0">
        <div className="flex items-center gap-2 text-blue-400">
          <Camera size={24} />
          <h1 className="text-lg font-bold tracking-tight">Receipt Cam</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-blue-500/30">
            <Check size={10} />
            Cloud Sync
          </div>
        </div>
      </header>

      {/* メインビューポート */}
      <main className="relative flex-1 bg-gray-950 flex items-center justify-center overflow-hidden">
        {!capturedImage ? (
          <>
            {/* カメラ映像 */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {/* 撮影補助ガイド */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="w-[85%] h-[75%] border-2 border-white/20 rounded-3xl border-dashed relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-white/20 text-xs font-medium uppercase tracking-widest rotate-90 sm:rotate-0">
                    Align Receipt Inside
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* 撮影後プレビュー画面 */
          <div className="absolute inset-0 z-20 flex flex-col items-center bg-black/95 p-4 animate-in fade-in duration-300">
            <div className="flex-1 w-full flex items-center justify-center">
              <img 
                src={capturedImage} 
                className="max-w-full max-h-full rounded-xl shadow-2xl object-contain border border-white/10"
                alt="Captured Receipt"
              />
            </div>
            
            <div className="flex gap-12 mt-8 mb-10">
              {/* キャンセル/撮り直しボタン */}
              <button 
                onClick={() => setCapturedImage(null)}
                className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                disabled={isSaving}
              >
                <X size={32} />
              </button>
              {/* 保存/共有ボタン */}
              <button 
                onClick={() => saveToFiles(capturedImage)}
                className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform ring-4 ring-blue-500/20 ${isSaving ? 'bg-blue-800' : 'bg-blue-600'}`}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 size={32} className="animate-spin" /> : <Save size={36} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 font-medium mb-4">
              「ファイルに保存」を選択してiCloudフォルダへ
            </p>
          </div>
        )}
      </main>

      {/* 下部コントローラー */}
      {!capturedImage && (
        <footer className="p-8 bg-gray-900 flex justify-around items-center border-t border-gray-800 shrink-0 pb-12">
          <button 
            onClick={toggleCamera}
            className="p-4 bg-gray-800 rounded-full text-gray-400 active:bg-gray-700 active:text-white transition-all shadow-inner"
          >
            <RefreshCw size={24} />
          </button>
          
          <button 
            onClick={takePhoto}
            className="w-20 h-20 bg-white rounded-full flex items-center justify-center p-1.5 shadow-[0_0_30px_rgba(255,255,255,0.15)] active:scale-90 transition-transform"
          >
            <div className="w-full h-full rounded-full border-4 border-black bg-white flex items-center justify-center">
              <div className="w-10 h-10 bg-gray-100 rounded-full border border-gray-300"></div>
            </div>
          </button>

          <button 
            onClick={() => setIsHistoryOpen(true)}
            className="p-4 bg-gray-800 rounded-full text-gray-400 active:bg-gray-700 active:text-white transition-all shadow-inner"
          >
            <ImageIcon size={24} />
          </button>
        </footer>
      )}

      {/* 非表示のキャンバス（画像生成用） */}
      <canvas ref={canvasRef} className="hidden" />

      {/* 履歴スライドパネル */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-950 animate-in slide-in-from-bottom duration-300">
          <div className="p-4 flex justify-between items-center bg-gray-900 border-b border-gray-800">
            <button onClick={() => setIsHistoryOpen(false)} className="flex items-center gap-1 text-gray-400 p-2">
              <ChevronLeft size={24} />
              <span className="font-medium">戻る</span>
            </button>
            <h2 className="text-lg font-bold">最近の送信履歴</h2>
            <div className="w-12"></div>
          </div>
          
          <div className="flex-1 p-6 overflow-y-auto">
            {saveList.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-700">
                <ImageIcon size={80} strokeWidth={1} />
                <p className="mt-4 font-medium text-sm">履歴はまだありません</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {saveList.map(item => (
                  <div key={item.id} className="aspect-square bg-gray-900 rounded-xl overflow-hidden border border-gray-800 shadow-md">
                    <img src={item.url} className="w-full h-full object-cover" alt="History Entry" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {saveList.length > 0 && (
            <div className="p-6 bg-gray-900/50 backdrop-blur">
              <button 
                onClick={() => setSaveList([])}
                className="w-full py-4 bg-red-900/10 text-red-500 border border-red-900/30 rounded-2xl flex items-center justify-center gap-2 font-bold"
              >
                <Trash2 size={20} /> 履歴をリセット
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}