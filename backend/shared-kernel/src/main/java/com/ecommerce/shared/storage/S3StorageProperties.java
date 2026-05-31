package com.ecommerce.shared.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "storage.s3")
public class S3StorageProperties {

    private String bucket = "";
    private String region = "ap-southeast-1";
    private String productsPrefix = "products/";
    private String avatarsPrefix = "avatars/";
    private String chatMediaPrefix = "chat-media/";
    private String tempPrefix = "temp/";
    private String cdnBaseUrl = "";
    private String encryption = "SSE-S3";
    private String cacheControl = "public, max-age=31536000, immutable";
    private long maxProductImageSizeBytes = 5L * 1024L * 1024L;
    private long maxAvatarSizeBytes = 5L * 1024L * 1024L;
    private long maxChatImageSizeBytes = 5L * 1024L * 1024L;
    private long maxChatVideoSizeBytes = 50L * 1024L * 1024L;

    public String getBucket() {
        return bucket;
    }

    public void setBucket(String bucket) {
        this.bucket = bucket;
    }

    public String getRegion() {
        return region;
    }

    public void setRegion(String region) {
        this.region = region;
    }

    public String getProductsPrefix() {
        return productsPrefix;
    }

    public void setProductsPrefix(String productsPrefix) {
        this.productsPrefix = productsPrefix;
    }

    public String getAvatarsPrefix() {
        return avatarsPrefix;
    }

    public void setAvatarsPrefix(String avatarsPrefix) {
        this.avatarsPrefix = avatarsPrefix;
    }

    public String getChatMediaPrefix() {
        return chatMediaPrefix;
    }

    public void setChatMediaPrefix(String chatMediaPrefix) {
        this.chatMediaPrefix = chatMediaPrefix;
    }

    public String getTempPrefix() {
        return tempPrefix;
    }

    public void setTempPrefix(String tempPrefix) {
        this.tempPrefix = tempPrefix;
    }

    public String getCdnBaseUrl() {
        return cdnBaseUrl;
    }

    public void setCdnBaseUrl(String cdnBaseUrl) {
        this.cdnBaseUrl = cdnBaseUrl;
    }

    public String getEncryption() {
        return encryption;
    }

    public void setEncryption(String encryption) {
        this.encryption = encryption;
    }

    public String getCacheControl() {
        return cacheControl;
    }

    public void setCacheControl(String cacheControl) {
        this.cacheControl = cacheControl;
    }

    public long getMaxProductImageSizeBytes() {
        return maxProductImageSizeBytes;
    }

    public void setMaxProductImageSizeBytes(long maxProductImageSizeBytes) {
        this.maxProductImageSizeBytes = maxProductImageSizeBytes;
    }

    public long getMaxAvatarSizeBytes() {
        return maxAvatarSizeBytes;
    }

    public void setMaxAvatarSizeBytes(long maxAvatarSizeBytes) {
        this.maxAvatarSizeBytes = maxAvatarSizeBytes;
    }

    public long getMaxChatImageSizeBytes() {
        return maxChatImageSizeBytes;
    }

    public void setMaxChatImageSizeBytes(long maxChatImageSizeBytes) {
        this.maxChatImageSizeBytes = maxChatImageSizeBytes;
    }

    public long getMaxChatVideoSizeBytes() {
        return maxChatVideoSizeBytes;
    }

    public void setMaxChatVideoSizeBytes(long maxChatVideoSizeBytes) {
        this.maxChatVideoSizeBytes = maxChatVideoSizeBytes;
    }
}
