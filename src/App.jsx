import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, X, Image as ImageIcon, Save, Trash2, Check, ChevronLeft, Loader2, AlertCircle, Lock } from 'lucide-react';

/**
 * Receipt Cam - Mac & iPhone 両対応・権限エラー対応強化版
 * 修正内容:
 * 1. 権限エラーの詳細化: ユーザーが権限を拒否した場合のUIを改善し、復帰方法を明示。
 * 2. 初期化プロセスの修正: ブラウザのセキュリティポリシーに適合するよう初期化フローを調整。
 * 3. モバイル表示の最適化: iPhoneのツールバー等によるズレを防止。
 */
export default function App() {
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [saveList, setSaveList] = useState([]);
  const [facingMode, setFacingMode] = useState('environment'); 
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isRequesting, setIsRequesting] = useState(false);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // カメラ起動処理
  const startCamera = async () => {
    if (isRequesting) return;
    setIsRequesting(true);
    
    try {
      setError(null);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      const constraints = {
        video: { 
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      let newStream;
      try {
        // まずは理想的な設定で試行
        newStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        console.warn("High-res failed, falling back to basic video", e);
        // 失敗した場合は最小限の設定で試行（Macの古いカメラ等への対応）
        newStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      // 詳細なエラー判別
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError("denied");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError("not_found");
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError("in_use");
      } else {
        setError("general_error");
      }
    } finally {
      setIsRequesting(false);
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [facingMode]);

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // アスペクト比を維持してキャンバスサイズを決定
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
  };

  const saveToFiles = async (imageData) => {
    setIsSaving(true);
    const timestamp = new Date().toLocaleString('ja-JP').replace(/[/ :]/g, '-');
    const fileName = `Receipt_${timestamp}.jpg`;
    try {
      const res = await fetch(imageData);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      
      if (navigator.share) {
        await navigator.share({ files: [file], title: 'レシートの保存' });
        setSaveList(prev => [{ id: Date.now(), url: imageData, name: fileName }, ...prev]);
        setCapturedImage(null);
      } else {
        // Share API非対応環境（Macブラウザ等）
        const link = document.createElement('a');
        link.href = imageData;
        link.download = fileName;
        link.click();
        setSaveList(prev => [{ id: Date.now(), url: imageData, name: fileName }, ...prev]);
        setCapturedImage(null);
      }
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-black text-white font-sans overflow-hidden select-none">
      {/* ヘッダー */}
      <header className="h-14 px-4 flex justify-between items-center bg-gray-900 border-b border-gray-800 z-30 shrink-0">
        <div className="flex items-center gap-2 text-blue-400">
          <Camera size={22} />
          <h1 className="text-md font-bold tracking-tight">Receipt Cam</h1>
        </div>
        <div className="flex items-center gap-1 bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-500/30">
          <Check size={10} /> Cloud Sync
        </div>
      </header>

      {/* メインエリア */}
      <main className="relative flex-1 bg-gray-950 flex flex-col items-center justify-center overflow-hidden min-h-0 w-full">
        {error ? (
          /* エラー時の表示 */
          <div className="flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500 max-w-sm">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
              {error === 'denied' ? <Lock size={32} className="text-red-500" /> : <AlertCircle size={32} className="text-red-500" />}
            </div>
            <h2 className="text-lg font-bold mb-4">
              {error === 'denied' ? 'カメラの使用が許可されていません' : 'カメラを起動できません'}
            </h2>
            
            <div className="text-xs text-gray-400 space-y-4 mb-8 leading-relaxed text-left bg-gray-900/80 p-5 rounded-2xl border border-white/5">
              {error === 'denied' ? (
                <>
                  <p className="font-bold text-gray-300">復旧方法:</p>
                  <p><strong>Macの場合:</strong> アドレスバー右端のカメラアイコンをクリックし、「常に許可」を選択してください。</p>
                  <p><strong>iPhoneの場合:</strong> 「設定 ＞ Safari ＞ カメラ」を「許可」に変更してください。</p>
                  <p className="text-[10px] opacity-70">※権限変更後はページを再読み込みしてください。</p>
                </>
              ) : (
                <p>カメラが見つからないか、別のアプリで使用されている可能性があります。接続を確認し、他のカメラアプリを閉じてください。</p>
              )}
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-blue-600 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-blue-600/20"
            >
              <RefreshCw size={18} />
              再読み込みして試行
            </button>
          </div>
        ) : !capturedImage ? (
          <div className="relative w-full h-full">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="w-full h-full object-cover" 
            />
            {/* 撮影ガイド */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="w-[85%] h-[70%] border-2 border-white/30 rounded-3xl border-dashed flex flex-col items-center justify-center">
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest text-center px-4">
                  レシートを枠内に合わせる
                </p>
                <div className="mt-2 w-16 h-1 bg-white/10 rounded-full"></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col w-full h-full p-4 items-center min-h-0 animate-in zoom-in-95 duration-200">
            <div className="flex-1 w-full flex items-center justify-center min-h-0">
              <img 
                src={capturedImage} 
                className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain border border-white/10"
                alt="Captured"
              />
            </div>
            
            <div className="h-32 flex flex-col items-center justify-center gap-3 shrink-0 w-full">
              <div className="flex gap-10">
                <button 
                  onClick={() => setCapturedImage(null)}
                  className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                  disabled={isSaving}
                >
                  <X size={28} />
                </button>
                <button 
                  onClick={() => saveToFiles(capturedImage)}
                  className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg active:scale-90 ring-4 ring-blue-500/20 transition-all ${isSaving ? 'bg-blue-800' : 'bg-blue-600'}`}
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 size={28} className="animate-spin" /> : <Save size={28} />}
                </button>
              </div>
              <p className="text-[10px] text-gray-500 font-medium">iCloudまたはダウンロードフォルダに保存</p>
            </div>
          </div>
        )}
      </main>

      {/* フッター */}
      {!capturedImage && !error && (
        <footer className="h-24 bg-gray-900 flex justify-around items-center border-t border-gray-800 shrink-0 pb-6">
          <button onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')} className="p-4 text-gray-400 active:text-white transition-colors">
            <RefreshCw size={24} />
          </button>
          <button onClick={takePhoto} className="w-20 h-20 bg-white rounded-full flex items-center justify-center p-1.5 shadow-xl active:scale-90 transition-transform">
            <div className="w-full h-full rounded-full border-2 border-black bg-white"></div>
          </button>
          <button onClick={() => setIsHistoryOpen(true)} className="p-4 text-gray-400 active:text-white transition-colors">
            <ImageIcon size={24} />
          </button>
        </footer>
      )}

      {/* 隠しキャンバス */}
      <canvas ref={canvasRef} className="hidden" />

      {/* 履歴パネル */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-950 animate-in slide-in-from-bottom duration-300">
          <div className="h-14 p-4 flex justify-between items-center bg-gray-900 border-b border-gray-800 shrink-0">
            <button onClick={() => setIsHistoryOpen(false)} className="flex items-center gap-1 text-gray-400 px-2 py-1 active:bg-gray-800 rounded-lg"><ChevronLeft size={20} /><span>戻る</span></button>
            <h2 className="text-md font-bold">送信履歴</h2>
            <div className="w-10"></div>
          </div>
          <div className="flex-1 p-4 overflow-y-auto">
            {saveList.length === 0 ? <p className="text-gray-700 text-center mt-20 font-medium">履歴はありません</p> : (
              <div className="grid grid-cols-3 gap-2">
                {saveList.map(item => (
                  <div key={item.id} className="aspect-square bg-gray-900 rounded-lg overflow-hidden border border-gray-800">
                    <img src={item.url} className="w-full h-full object-cover" alt="History" />
                  </div>
                ))}
              </div>
            )}
          </div>
          {saveList.length > 0 && (
            <div className="p-6 shrink-0"><button onClick={() => setSaveList([])} className="w-full py-4 bg-red-900/10 text-red-500 border border-red-900/30 rounded-xl flex items-center justify-center gap-2 font-bold active:bg-red-900/20"><Trash2 size={18} /> 履歴をクリア</button></div>
          )}
        </div>
      )}
    </div>
  );
}