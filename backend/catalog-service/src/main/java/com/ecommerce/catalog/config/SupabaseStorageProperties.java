package com.ecommerce.catalog.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "supabase.storage")
public class SupabaseStorageProperties {

    private String url = "";
    private String serviceRoleKey = "";
    private String bucket = "product-images";
    private String productFolder = "products";
    private long maxProductImageSizeBytes = 5 * 1024 * 1024;

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public String getServiceRoleKey() {
        return serviceRoleKey;
    }

    public void setServiceRoleKey(String serviceRoleKey) {
        this.serviceRoleKey = serviceRoleKey;
    }

    public String getBucket() {
        return bucket;
    }

    public void setBucket(String bucket) {
        this.bucket = bucket;
    }

    public String getProductFolder() {
        return productFolder;
    }

    public void setProductFolder(String productFolder) {
        this.productFolder = productFolder;
    }

    public long getMaxProductImageSizeBytes() {
        return maxProductImageSizeBytes;
    }

    public void setMaxProductImageSizeBytes(long maxProductImageSizeBytes) {
        this.maxProductImageSizeBytes = maxProductImageSizeBytes;
    }
}
