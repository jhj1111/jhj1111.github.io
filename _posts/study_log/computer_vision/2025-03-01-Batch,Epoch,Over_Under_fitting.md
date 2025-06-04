---
title: Batch size, iteration, epoch
thumbnail: https://discuss.datasciencedojo.com/uploads/default/original/1X/808c4d2074b4ab07065cd8b316cd234679d5b31b.png
layout: post
author: jhj
categories:
  - StudyLog
  - ComputerVision
tags:
  - image_classification
  - vision
  - deep_learning
excerpt: 학습 관련 하이퍼 파라미터
project_rank: "680"
sticker: emoji//1f4aa
---

![출처: [https://wikidocs.net/55580](https://wikidocs.net/55580)](/assets/images/study_log/computer_vision/Batch,Epoch,Over_Under_fitting/image.png)

출처: [https://wikidocs.net/55580](https://wikidocs.net/55580)

- 총 data(dataset)의 개수를 2,000개라고 가정
- 이 dataset을 200개 단위로 나눔
- 이때 다음과 같은 식이 성립
    - **Total_data = iteration x Batch_size**
- Batch size와 Iteration의 크기와 상관 없이 **하나의 dataset을 순환하는 것**을 1 **epoch**라고 함

## Over/Under fitting

![출처: [https://www.kaggle.com/discussions/getting-started/166897](https://www.kaggle.com/discussions/getting-started/166897)](/assets/images/study_log/computer_vision/Batch,Epoch,Over_Under_fitting/image1.png)

출처: [https://www.kaggle.com/discussions/getting-started/166897](https://www.kaggle.com/discussions/getting-started/166897)

1. **Under fitting**
- **모델이 지나치게 단순**해 명확한 답을 제시하지 못하는 상황
- 문제점 및 해결방안
    - 학습 epoch 증가
    - 은닉층의 개수 증가 등 모델의 복잡성 증가
    - 데이터의 노이즈 감소

![고양이임. 암튼 고양이임](/assets/images/study_log/computer_vision/Batch,Epoch,Over_Under_fitting/image2.png)

고양이임. 암튼 고양이임

1. **Over fiiting**
- deep learning에서 까다로운 문제 중 하나
- 모델이 **학습데이터**에 **지나치게 일치**된 상황
- 이게 왜 문제인가?
    - 모델을 학습시킬 때 사용하는 학습 데이터는 실제 상황의 극히 일부분임
    - 위의 그림에서 보듯 **모든 데이터가 완벽하게 분리되진 않음(노이즈)**
    - 또한 데이터 자체도 완벽하지 않음(잘못된 데이터 등)
    - 즉 실제 데이터가 들어왔을 때 재대로 동작하지 않을 가능성이 메우 높음
- 해결방안
    - 학습 데이터 부족 → 학습 데이터 수 증가
    - 모델의 복잡성 감소
    - Early stopping(validation의 결과에 따라 학습을 중간에 멈추는 것)
    - Drop out 및 Regularization 등