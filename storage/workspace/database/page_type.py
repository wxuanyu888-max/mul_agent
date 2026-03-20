"""
页面类型枚举定义
"""

from enum import IntEnum


class PageType(IntEnum):
    """
    页面类型枚举
    
    DATA_PAGE: 数据页，存储实际的数据记录
    INDEX_PAGE: 索引页，存储索引数据
    FREELIST_PAGE: 空闲页链表，存储空闲页面列表
    HEADER_PAGE: 头部页，存储数据库元信息
    """
    DATA_PAGE = 1
    INDEX_PAGE = 2
    FREELIST_PAGE = 3
    HEADER_PAGE = 4
    
    def __str__(self):
        return self.name
