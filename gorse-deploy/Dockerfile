# Gorse Recommendation System
FROM zhenghaoz/gorse-master:latest

# Expose ports
EXPOSE 8086 8087 8088

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:8087/api/health || exit 1

# Start Gorse
CMD ["gorse-master", "-c", "/etc/gorse/config.toml"]
