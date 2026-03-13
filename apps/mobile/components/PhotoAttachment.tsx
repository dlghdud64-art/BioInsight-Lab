import { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  Linking,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImagePlus, X, RotateCcw, Settings, Trash2 } from "lucide-react-native";
import { apiClient } from "../lib/api";
import { logEvent } from "../lib/analytics";

export interface AttachedPhoto {
  uri: string;
  uploadedUrl?: string;
  status: "pending" | "uploading" | "success" | "failed";
  fileName?: string;
}

interface PhotoAttachmentProps {
  photos: AttachedPhoto[];
  onChange: (photos: AttachedPhoto[]) => void;
  /** 첨부 대상 컨텍스트 (analytics용) */
  context: string;
  /** 최대 첨부 수 (기본 5) */
  maxCount?: number;
  /** 업로드 엔드포인트 */
  uploadEndpoint?: string;
}

export function PhotoAttachment({
  photos,
  onChange,
  context,
  maxCount = 5,
  uploadEndpoint = "/api/uploads",
}: PhotoAttachmentProps) {
  const [isPickerActive, setIsPickerActive] = useState(false);

  const requestPermission = useCallback(
    async (type: "camera" | "library"): Promise<boolean> => {
      if (type === "camera") {
        const { status, canAskAgain } =
          await ImagePicker.requestCameraPermissionsAsync();
        if (status === "granted") return true;

        logEvent("photo_permission_denied", { type: "camera", context });

        if (!canAskAgain) {
          Alert.alert(
            "카메라 권한 필요",
            "설정에서 카메라 접근 권한을 허용해주세요.",
            [
              { text: "취소", style: "cancel" },
              {
                text: "설정으로 이동",
                onPress: () => Linking.openSettings(),
              },
            ]
          );
        }
        return false;
      }

      const { status, canAskAgain } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status === "granted") return true;

      logEvent("photo_permission_denied", { type: "library", context });

      if (!canAskAgain) {
        Alert.alert(
          "사진 접근 권한 필요",
          "설정에서 사진 접근 권한을 허용해주세요.",
          [
            { text: "취소", style: "cancel" },
            {
              text: "설정으로 이동",
              onPress: () => Linking.openSettings(),
            },
          ]
        );
      }
      return false;
    },
    [context]
  );

  const pickFromCamera = useCallback(async () => {
    if (isPickerActive) return;
    if (photos.length >= maxCount) {
      Alert.alert("안내", `최대 ${maxCount}장까지 첨부할 수 있습니다.`);
      return;
    }

    const hasPermission = await requestPermission("camera");
    if (!hasPermission) return;

    setIsPickerActive(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const newPhoto: AttachedPhoto = {
          uri: asset.uri,
          fileName: asset.fileName ?? `photo_${Date.now()}.jpg`,
          status: "pending",
        };
        logEvent("photo_attached", { source: "camera", context });
        const updated = [...photos, newPhoto];
        onChange(updated);
        uploadPhoto(newPhoto, updated.length - 1, updated);
      }
    } finally {
      setIsPickerActive(false);
    }
  }, [photos, maxCount, requestPermission, isPickerActive, context, onChange]);

  const pickFromLibrary = useCallback(async () => {
    if (isPickerActive) return;
    if (photos.length >= maxCount) {
      Alert.alert("안내", `최대 ${maxCount}장까지 첨부할 수 있습니다.`);
      return;
    }

    const hasPermission = await requestPermission("library");
    if (!hasPermission) return;

    setIsPickerActive(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: maxCount - photos.length,
      });

      if (!result.canceled && result.assets.length > 0) {
        const newPhotos: AttachedPhoto[] = result.assets.map((asset) => ({
          uri: asset.uri,
          fileName: asset.fileName ?? `photo_${Date.now()}.jpg`,
          status: "pending" as const,
        }));

        logEvent("photo_attached", {
          source: "library",
          count: newPhotos.length,
          context,
        });

        const updated = [...photos, ...newPhotos];
        onChange(updated);

        // 순차 업로드
        newPhotos.forEach((photo, i) => {
          uploadPhoto(photo, photos.length + i, updated);
        });
      }
    } finally {
      setIsPickerActive(false);
    }
  }, [photos, maxCount, requestPermission, isPickerActive, context, onChange]);

  const uploadPhoto = useCallback(
    async (
      photo: AttachedPhoto,
      index: number,
      currentPhotos: AttachedPhoto[]
    ) => {
      const updated = [...currentPhotos];
      updated[index] = { ...photo, status: "uploading" };
      onChange(updated);

      try {
        const formData = new FormData();
        formData.append("file", {
          uri: photo.uri,
          type: "image/jpeg",
          name: photo.fileName ?? "photo.jpg",
        } as any);

        const res = await apiClient.post(uploadEndpoint, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 30000,
        });

        const uploadedUrl = res.data?.url ?? res.data?.fileUrl ?? photo.uri;
        updated[index] = { ...photo, status: "success", uploadedUrl };
        onChange([...updated]);
        logEvent("photo_upload_success", { context });
      } catch (err) {
        updated[index] = { ...photo, status: "failed" };
        onChange([...updated]);
        logEvent("photo_upload_failed", {
          context,
          error: String(err),
        });
      }
    },
    [onChange, uploadEndpoint, context]
  );

  const retryUpload = useCallback(
    (index: number) => {
      logEvent("photo_retry_clicked", { context });
      const photo = photos[index];
      if (photo) {
        uploadPhoto(photo, index, photos);
      }
    },
    [photos, uploadPhoto, context]
  );

  const removePhoto = useCallback(
    (index: number) => {
      const updated = photos.filter((_, i) => i !== index);
      onChange(updated);
    },
    [photos, onChange]
  );

  const showPickerOptions = useCallback(() => {
    Alert.alert("사진 첨부", "사진을 가져올 방법을 선택하세요.", [
      { text: "카메라 촬영", onPress: pickFromCamera },
      { text: "앨범에서 선택", onPress: pickFromLibrary },
      { text: "취소", style: "cancel" },
    ]);
  }, [pickFromCamera, pickFromLibrary]);

  return (
    <View>
      {/* 첨부된 사진 썸네일 */}
      {photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-3"
          contentContainerStyle={{ gap: 8 }}
        >
          {photos.map((photo, idx) => (
            <View
              key={`${photo.uri}-${idx}`}
              className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200"
            >
              <Image
                source={{ uri: photo.uri }}
                className="w-full h-full"
                resizeMode="cover"
              />

              {/* 업로드 상태 오버레이 */}
              {photo.status === "uploading" && (
                <View className="absolute inset-0 bg-black/40 items-center justify-center">
                  <ActivityIndicator color="white" size="small" />
                </View>
              )}

              {photo.status === "failed" && (
                <View className="absolute inset-0 bg-red-500/60 items-center justify-center">
                  <Pressable
                    className="bg-white rounded-full p-1.5"
                    onPress={() => retryUpload(idx)}
                  >
                    <RotateCcw size={14} color="#ef4444" />
                  </Pressable>
                </View>
              )}

              {/* 삭제 버튼 */}
              <Pressable
                className="absolute top-1 right-1 bg-black/50 rounded-full p-0.5"
                onPress={() => removePhoto(idx)}
                hitSlop={8}
              >
                <X size={12} color="white" />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}

      {/* 실패한 업로드 안내 */}
      {photos.some((p) => p.status === "failed") && (
        <View className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3 flex-row items-center gap-2">
          <RotateCcw size={14} color="#ef4444" />
          <Text className="text-xs text-red-600 flex-1">
            일부 사진 업로드에 실패했습니다. 썸네일을 탭하여 재시도하세요.
          </Text>
        </View>
      )}

      {/* 추가 버튼 */}
      {photos.length < maxCount && (
        <View className="flex-row gap-2">
          <Pressable
            className="flex-1 flex-row items-center justify-center gap-1.5 border border-slate-200 rounded-xl py-2.5"
            onPress={pickFromCamera}
            disabled={isPickerActive}
          >
            <Camera size={16} color="#475569" />
            <Text className="text-xs font-medium text-slate-600">촬영</Text>
          </Pressable>
          <Pressable
            className="flex-1 flex-row items-center justify-center gap-1.5 border border-slate-200 rounded-xl py-2.5"
            onPress={pickFromLibrary}
            disabled={isPickerActive}
          >
            <ImagePlus size={16} color="#475569" />
            <Text className="text-xs font-medium text-slate-600">앨범</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
