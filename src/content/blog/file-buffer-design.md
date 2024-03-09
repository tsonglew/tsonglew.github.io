---
author: Tsong Lew
pubDatetime: 2024-03-09T09:42:00.000+08:00
modDatetime: 2024-03-09T09:42:00.000+08:00
title: 客户端文件缓冲区设计
slug: file-buffer-design
featured: true
draft: false
tags:
  - buffer
  - design
description: 在数据采集的业务场景中，常常会有客户端向服务端发送大量数据的场景，如果客户端网络环境不好或者传输流量超过网络限制，就会导致数据丢失。为了解决这个问题，我们可以在客户端引入文件缓冲区。这篇文章将介绍客户端文件缓冲区的设计。
---

## Table of contents

## 背景
